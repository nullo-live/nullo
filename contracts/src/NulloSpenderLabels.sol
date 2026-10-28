// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NulloSpenderLabels
/// @notice Community notes about spender addresses on Robinhood Chain. A spender is any address a wallet has given
///         token permission to (an ERC-20 allowance, an NFT operator approval, a Permit2 allowance).
///         Any wallet can attach one label to a spender: a short name, a category code and a link (the link text
///         travels in the event, its keccak-256 hash stays in storage). A wallet can update or remove its own label.
///         Any wallet can also flag a spender once with a reason code, and take the flag back.
///         Labels and flags are counted per spender and listed; they never hide, block or rank anything. Readers see
///         who wrote each label and decide for themselves.
/// @dev No owner, no admin, no fee, no pause, no upgrade path, no constructor arguments, no token. The contract never
///      holds funds: no function is payable and there is no receive or fallback, so ETH transfers revert.
///      Nothing here touches allowances: revoking a permission is a call the wallet makes to the token itself.
///      On Arbitrum-style chains `block.number` reports the parent chain's block, so the chain's own block is read
///      from the ArbSys precompile when it answers, and from `block.number` everywhere else (local tests).
contract NulloSpenderLabels {
    /// @notice Longest label name, in bytes (printable ASCII, no leading or trailing space).
    uint256 public constant MAX_NAME = 32;
    /// @notice Longest link, in bytes (printable ASCII, must start with "https://").
    uint256 public constant MAX_URL = 128;
    /// @notice Categories 1..MAX_CATEGORY: 1 exchange router, 2 lending, 3 NFT marketplace, 4 bridge,
    ///         5 launchpad, 6 token permit service, 7 app or game, 8 other.
    uint8 public constant MAX_CATEGORY = 8;
    /// @notice Flag reasons 1..MAX_REASON: 1 unexpected transfers reported, 2 imitates a known app,
    ///         3 source not published, 4 linked from a phishing site, 5 abandoned or replaced, 6 other.
    uint8 public constant MAX_REASON = 6;
    /// @notice Most entries a paginated read returns at once.
    uint256 public constant MAX_PAGE = 100;

    /// @dev ArbSys precompile. `arbBlockNumber()` returns the chain's own block number.
    address private constant ARB_SYS = address(0x64);
    bytes4 private constant ARB_BLOCK_NUMBER = 0xa3b1b31d;
    /// @dev Gas forwarded to ArbSys. The real precompile needs about a thousand; the cap keeps a chain (or a local
    ///      fork) where 0x64 holds failing code from burning the whole transaction's gas.
    uint256 private constant ARB_SYS_GAS = 30_000;

    /// @notice One wallet's label for one spender.
    struct Label {
        address author;
        uint8 category;
        uint64 updatedAt;
        uint64 chainBlock;
        bytes32 urlHash;
        string name;
    }

    /// @notice Totals for one spender.
    struct Counts {
        uint32 labels;
        uint32 flags;
        uint32[9] byCategory; // index 0 unused
        uint32[7] byReason; // index 0 unused
    }

    error ZeroSpender();
    error BadName();
    error BadUrl();
    error BadCategory(uint8 category);
    error BadReason(uint8 reason);
    error NoLabel(address spender, address author);
    error AlreadyFlagged(address spender);
    error NotFlagged(address spender);
    error SelfFlag();
    error PageTooLarge();

    /// @notice A label was written (`updated` is true when the author replaced an earlier label of theirs).
    event Labeled(
        address indexed spender,
        address indexed author,
        string name,
        uint8 category,
        string url,
        bytes32 urlHash,
        bool updated,
        uint64 chainBlock
    );
    /// @notice An author removed their label.
    event LabelRemoved(address indexed spender, address indexed author, uint64 chainBlock);
    /// @notice A wallet flagged a spender.
    event Flagged(address indexed spender, address indexed flagger, uint8 reason, uint64 chainBlock);
    /// @notice A wallet took its flag back.
    event Unflagged(address indexed spender, address indexed flagger, uint64 chainBlock);

    // spender => author => label (author == 0 means none)
    mapping(address => mapping(address => Label)) private _labels;
    // spender => authors with a live label (swap-and-pop on remove)
    mapping(address => address[]) private _authors;
    mapping(address => mapping(address => uint256)) private _authorIndex; // 1-based
    // author => spenders that author labelled (live labels)
    mapping(address => address[]) private _byAuthor;
    mapping(address => mapping(address => uint256)) private _byAuthorIndex; // 1-based
    // spender => flagger => reason (0 = not flagged)
    mapping(address => mapping(address => uint8)) private _flagOf;
    mapping(address => Counts) private _counts;
    // every spender that was ever labelled or flagged, in first-seen order
    address[] private _spenders;
    mapping(address => bool) private _known;

    uint256 public totalLabels;
    uint256 public totalFlags;

    // ---------------------------------------------------------------- writes

    /// @notice Writes or replaces the caller's label for `spender`. `url` may be empty; otherwise it starts with
    ///         "https://". The contract checks format only; it cannot know whether a label is true.
    function setLabel(address spender, string calldata name, uint8 category, string calldata url) external {
        if (spender == address(0)) revert ZeroSpender();
        _checkName(name);
        if (category == 0 || category > MAX_CATEGORY) revert BadCategory(category);
        bytes32 urlHash = _checkUrl(url);
        uint64 blk = chainBlock();

        Label storage l = _labels[spender][msg.sender];
        Counts storage c = _counts[spender];
        bool updated = l.author != address(0);
        if (updated) {
            c.byCategory[l.category] -= 1;
        } else {
            l.author = msg.sender;
            _authors[spender].push(msg.sender);
            _authorIndex[spender][msg.sender] = _authors[spender].length;
            _byAuthor[msg.sender].push(spender);
            _byAuthorIndex[msg.sender][spender] = _byAuthor[msg.sender].length;
            c.labels += 1;
            totalLabels += 1;
        }
        c.byCategory[category] += 1;
        l.category = category;
        l.updatedAt = uint64(block.timestamp);
        l.chainBlock = blk;
        l.urlHash = urlHash;
        l.name = name;
        _remember(spender);
        emit Labeled(spender, msg.sender, name, category, url, urlHash, updated, blk);
    }

    /// @notice Removes the caller's own label for `spender`.
    function removeLabel(address spender) external {
        Label storage l = _labels[spender][msg.sender];
        if (l.author == address(0)) revert NoLabel(spender, msg.sender);
        Counts storage c = _counts[spender];
        c.byCategory[l.category] -= 1;
        c.labels -= 1;
        totalLabels -= 1;
        delete _labels[spender][msg.sender];
        _pop(_authors[spender], _authorIndex[spender], msg.sender);
        _pop(_byAuthor[msg.sender], _byAuthorIndex[msg.sender], spender);
        emit LabelRemoved(spender, msg.sender, chainBlock());
    }

    /// @notice Flags `spender` once with a reason code. A flag is a public note, not a verdict: nothing is hidden.
    function flag(address spender, uint8 reason) external {
        if (spender == address(0)) revert ZeroSpender();
        if (spender == msg.sender) revert SelfFlag();
        if (reason == 0 || reason > MAX_REASON) revert BadReason(reason);
        if (_flagOf[spender][msg.sender] != 0) revert AlreadyFlagged(spender);
        _flagOf[spender][msg.sender] = reason;
        Counts storage c = _counts[spender];
        c.flags += 1;
        c.byReason[reason] += 1;
        totalFlags += 1;
        _remember(spender);
        emit Flagged(spender, msg.sender, reason, chainBlock());
    }

    /// @notice Takes the caller's flag on `spender` back.
    function unflag(address spender) external {
        uint8 reason = _flagOf[spender][msg.sender];
        if (reason == 0) revert NotFlagged(spender);
        delete _flagOf[spender][msg.sender];
        Counts storage c = _counts[spender];
        c.flags -= 1;
        c.byReason[reason] -= 1;
        totalFlags -= 1;
        emit Unflagged(spender, msg.sender, chainBlock());
    }

    // ---------------------------------------------------------------- reads

    /// @notice The label `author` wrote for `spender` (author field is zero when there is none).
    function getLabel(address spender, address author) external view returns (Label memory) {
        return _labels[spender][author];
    }

    /// @notice Labels of `spender`, `limit` at most (≤ MAX_PAGE), starting at `offset` in the author list.
    function labelsOf(address spender, uint256 offset, uint256 limit) external view returns (Label[] memory out) {
        if (limit > MAX_PAGE) revert PageTooLarge();
        address[] storage list = _authors[spender];
        uint256 n = _window(list.length, offset, limit);
        out = new Label[](n);
        for (uint256 i = 0; i < n; i++) out[i] = _labels[spender][list[offset + i]];
    }

    /// @notice Label and flag totals of `spender`, by category and by reason (index 0 unused).
    function countsOf(address spender)
        external
        view
        returns (uint32 labels, uint32 flags, uint32[9] memory byCategory, uint32[7] memory byReason)
    {
        Counts storage c = _counts[spender];
        return (c.labels, c.flags, c.byCategory, c.byReason);
    }

    /// @notice Reason code `flagger` used for `spender` (0 = not flagged).
    function flagOf(address spender, address flagger) external view returns (uint8) {
        return _flagOf[spender][flagger];
    }

    /// @notice Number of live labels `author` has written.
    function labelCountOf(address author) external view returns (uint256) {
        return _byAuthor[author].length;
    }

    /// @notice Spenders `author` has labelled, `limit` at most (≤ MAX_PAGE), from `offset`.
    function spendersLabelledBy(address author, uint256 offset, uint256 limit) external view returns (address[] memory out) {
        if (limit > MAX_PAGE) revert PageTooLarge();
        address[] storage list = _byAuthor[author];
        uint256 n = _window(list.length, offset, limit);
        out = new address[](n);
        for (uint256 i = 0; i < n; i++) out[i] = list[offset + i];
    }

    /// @notice Number of spenders that were ever labelled or flagged.
    function spenderCount() external view returns (uint256) {
        return _spenders.length;
    }

    /// @notice Spenders in first-seen order, `limit` at most (≤ MAX_PAGE), from `offset`.
    function spendersFrom(uint256 offset, uint256 limit) external view returns (address[] memory out) {
        if (limit > MAX_PAGE) revert PageTooLarge();
        uint256 n = _window(_spenders.length, offset, limit);
        out = new address[](n);
        for (uint256 i = 0; i < n; i++) out[i] = _spenders[offset + i];
    }

    /// @notice The chain's own block number (ArbSys on Robinhood Chain, block.number elsewhere).
    function chainBlock() public view returns (uint64) {
        (bool ok, bytes memory ret) = ARB_SYS.staticcall{gas: ARB_SYS_GAS}(abi.encodeWithSelector(ARB_BLOCK_NUMBER));
        if (ok && ret.length == 32) {
            uint256 n = abi.decode(ret, (uint256));
            if (n != 0 && n <= type(uint64).max) return uint64(n);
        }
        return uint64(block.number);
    }

    // ---------------------------------------------------------------- internals

    function _remember(address spender) private {
        if (!_known[spender]) {
            _known[spender] = true;
            _spenders.push(spender);
        }
    }

    function _pop(address[] storage list, mapping(address => uint256) storage index, address who) private {
        uint256 i = index[who];
        uint256 last = list.length;
        if (i != last) {
            address moved = list[last - 1];
            list[i - 1] = moved;
            index[moved] = i;
        }
        list.pop();
        delete index[who];
    }

    function _window(uint256 length, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (offset >= length) return 0;
        uint256 left = length - offset;
        return left < limit ? left : limit;
    }

    function _checkName(string calldata name) private pure {
        bytes calldata b = bytes(name);
        if (b.length == 0 || b.length > MAX_NAME) revert BadName();
        if (b[0] == 0x20 || b[b.length - 1] == 0x20) revert BadName();
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] < 0x20 || b[i] > 0x7e) revert BadName();
        }
    }

    function _checkUrl(string calldata url) private pure returns (bytes32) {
        bytes calldata b = bytes(url);
        if (b.length == 0) return bytes32(0);
        if (b.length > MAX_URL || b.length < 9) revert BadUrl();
        if (
            b[0] != "h" || b[1] != "t" || b[2] != "t" || b[3] != "p" || b[4] != "s" || b[5] != ":" || b[6] != "/"
                || b[7] != "/"
        ) revert BadUrl();
        for (uint256 i = 8; i < b.length; i++) {
            if (b[i] <= 0x20 || b[i] > 0x7e) revert BadUrl();
        }
        return keccak256(b);
    }
}
