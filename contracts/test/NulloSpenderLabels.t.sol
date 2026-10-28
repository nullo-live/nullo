// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NulloSpenderLabels} from "../src/NulloSpenderLabels.sol";

contract NulloSpenderLabelsTest is Test {
    NulloSpenderLabels book;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address spender = makeAddr("router");
    address other = makeAddr("other");

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
    event LabelRemoved(address indexed spender, address indexed author, uint64 chainBlock);
    event Flagged(address indexed spender, address indexed flagger, uint8 reason, uint64 chainBlock);
    event Unflagged(address indexed spender, address indexed flagger, uint64 chainBlock);

    function setUp() public {
        book = new NulloSpenderLabels();
    }

    function _counts(address s) internal view returns (uint32 labels, uint32 flags, uint32[9] memory cat, uint32[7] memory why) {
        return book.countsOf(s);
    }

    // ------------------------------------------------------------ labels

    function test_setLabel_storesAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit Labeled(spender, alice, "Swap router", 1, "https://example.org/docs", keccak256("https://example.org/docs"), false, uint64(block.number));
        vm.prank(alice);
        book.setLabel(spender, "Swap router", 1, "https://example.org/docs");

        NulloSpenderLabels.Label memory l = book.getLabel(spender, alice);
        assertEq(l.author, alice);
        assertEq(l.name, "Swap router");
        assertEq(l.category, 1);
        assertEq(l.urlHash, keccak256("https://example.org/docs"));
        assertEq(l.updatedAt, block.timestamp);
        (uint32 labels,, uint32[9] memory cat,) = _counts(spender);
        assertEq(labels, 1);
        assertEq(cat[1], 1);
        assertEq(book.totalLabels(), 1);
        assertEq(book.spenderCount(), 1);
        assertEq(book.labelCountOf(alice), 1);
    }

    function test_setLabel_emptyUrlStoresZeroHash() public {
        vm.prank(alice);
        book.setLabel(spender, "Router", 8, "");
        assertEq(book.getLabel(spender, alice).urlHash, bytes32(0));
    }

    function test_setLabel_updateKeepsOnePerWallet() public {
        vm.startPrank(alice);
        book.setLabel(spender, "First", 1, "");
        vm.expectEmit(true, true, false, true);
        emit Labeled(spender, alice, "Second", 3, "", bytes32(0), true, uint64(block.number));
        book.setLabel(spender, "Second", 3, "");
        vm.stopPrank();
        (uint32 labels,, uint32[9] memory cat,) = _counts(spender);
        assertEq(labels, 1);
        assertEq(cat[1], 0);
        assertEq(cat[3], 1);
        assertEq(book.totalLabels(), 1);
        assertEq(book.getLabel(spender, alice).name, "Second");
        assertEq(book.labelsOf(spender, 0, 10).length, 1);
    }

    function test_manyAuthors_listedAndCounted() public {
        vm.prank(alice);
        book.setLabel(spender, "A", 1, "");
        vm.prank(bob);
        book.setLabel(spender, "B", 1, "");
        vm.prank(carol);
        book.setLabel(spender, "C", 2, "");
        NulloSpenderLabels.Label[] memory all = book.labelsOf(spender, 0, 10);
        assertEq(all.length, 3);
        assertEq(all[0].author, alice);
        assertEq(all[2].name, "C");
        NulloSpenderLabels.Label[] memory page = book.labelsOf(spender, 1, 1);
        assertEq(page.length, 1);
        assertEq(page[0].author, bob);
        assertEq(book.labelsOf(spender, 5, 10).length, 0);
        (uint32 labels,, uint32[9] memory cat,) = _counts(spender);
        assertEq(labels, 3);
        assertEq(cat[1], 2);
        assertEq(cat[2], 1);
    }

    function test_removeLabel_swapAndPop() public {
        vm.prank(alice);
        book.setLabel(spender, "A", 1, "");
        vm.prank(bob);
        book.setLabel(spender, "B", 2, "");
        vm.prank(carol);
        book.setLabel(spender, "C", 2, "");

        vm.expectEmit(true, true, false, true);
        emit LabelRemoved(spender, alice, uint64(block.number));
        vm.prank(alice);
        book.removeLabel(spender);

        NulloSpenderLabels.Label[] memory all = book.labelsOf(spender, 0, 10);
        assertEq(all.length, 2);
        assertEq(all[0].author, carol);
        assertEq(all[1].author, bob);
        assertEq(book.getLabel(spender, alice).author, address(0));
        (uint32 labels,, uint32[9] memory cat,) = _counts(spender);
        assertEq(labels, 2);
        assertEq(cat[1], 0);
        assertEq(cat[2], 2);
        assertEq(book.labelCountOf(alice), 0);
        // spender stays in the discovery list
        assertEq(book.spenderCount(), 1);

        // label again after removing
        vm.prank(alice);
        book.setLabel(spender, "Again", 4, "");
        assertEq(book.labelsOf(spender, 0, 10).length, 3);
        assertEq(book.spenderCount(), 1);
    }

    function test_removeLabel_withoutLabelReverts() public {
        vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.NoLabel.selector, spender, alice));
        vm.prank(alice);
        book.removeLabel(spender);
    }

    function test_spendersLabelledBy() public {
        vm.startPrank(alice);
        book.setLabel(spender, "A", 1, "");
        book.setLabel(other, "B", 2, "");
        vm.stopPrank();
        address[] memory list = book.spendersLabelledBy(alice, 0, 10);
        assertEq(list.length, 2);
        assertEq(list[0], spender);
        assertEq(list[1], other);
        vm.prank(alice);
        book.removeLabel(spender);
        list = book.spendersLabelledBy(alice, 0, 10);
        assertEq(list.length, 1);
        assertEq(list[0], other);
    }

    function test_validation_name() public {
        vm.startPrank(alice);
        vm.expectRevert(NulloSpenderLabels.BadName.selector);
        book.setLabel(spender, "", 1, "");
        vm.expectRevert(NulloSpenderLabels.BadName.selector);
        book.setLabel(spender, " lead", 1, "");
        vm.expectRevert(NulloSpenderLabels.BadName.selector);
        book.setLabel(spender, "trail ", 1, "");
        vm.expectRevert(NulloSpenderLabels.BadName.selector);
        book.setLabel(spender, "123456789012345678901234567890123", 1, "");
        vm.expectRevert(NulloSpenderLabels.BadName.selector);
        book.setLabel(spender, unicode"café", 1, "");
        vm.expectRevert(NulloSpenderLabels.BadName.selector);
        book.setLabel(spender, "tab\there", 1, "");
        book.setLabel(spender, "12345678901234567890123456789012", 1, "");
        vm.stopPrank();
    }

    function test_validation_categoryAndSpender() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.BadCategory.selector, 0));
        book.setLabel(spender, "x", 0, "");
        vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.BadCategory.selector, 9));
        book.setLabel(spender, "x", 9, "");
        vm.expectRevert(NulloSpenderLabels.ZeroSpender.selector);
        book.setLabel(address(0), "x", 1, "");
        vm.stopPrank();
    }

    function test_validation_url() public {
        vm.startPrank(alice);
        vm.expectRevert(NulloSpenderLabels.BadUrl.selector);
        book.setLabel(spender, "x", 1, "http://example.org");
        vm.expectRevert(NulloSpenderLabels.BadUrl.selector);
        book.setLabel(spender, "x", 1, "https://");
        vm.expectRevert(NulloSpenderLabels.BadUrl.selector);
        book.setLabel(spender, "x", 1, "https://exa mple.org");
        vm.expectRevert(NulloSpenderLabels.BadUrl.selector);
        book.setLabel(spender, "x", 1, "javascript:alert(1)");
        bytes memory long = new bytes(121);
        for (uint256 i = 0; i < long.length; i++) long[i] = "a";
        vm.expectRevert(NulloSpenderLabels.BadUrl.selector);
        book.setLabel(spender, "x", 1, string.concat("https://", string(long)));
        book.setLabel(spender, "x", 1, "https://a");
        vm.stopPrank();
    }

    // ------------------------------------------------------------ flags

    function test_flag_countsAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit Flagged(spender, alice, 2, uint64(block.number));
        vm.prank(alice);
        book.flag(spender, 2);
        vm.prank(bob);
        book.flag(spender, 2);
        vm.prank(carol);
        book.flag(spender, 5);
        (, uint32 flags,, uint32[7] memory why) = _counts(spender);
        assertEq(flags, 3);
        assertEq(why[2], 2);
        assertEq(why[5], 1);
        assertEq(book.flagOf(spender, alice), 2);
        assertEq(book.totalFlags(), 3);
        assertEq(book.spenderCount(), 1);
    }

    function test_flag_oncePerWallet() public {
        vm.startPrank(alice);
        book.flag(spender, 1);
        vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.AlreadyFlagged.selector, spender));
        book.flag(spender, 3);
        vm.stopPrank();
    }

    function test_unflag_andFlagAgain() public {
        vm.startPrank(alice);
        book.flag(spender, 1);
        vm.expectEmit(true, true, false, true);
        emit Unflagged(spender, alice, uint64(block.number));
        book.unflag(spender);
        (, uint32 flags,, uint32[7] memory why) = _counts(spender);
        assertEq(flags, 0);
        assertEq(why[1], 0);
        assertEq(book.flagOf(spender, alice), 0);
        book.flag(spender, 4);
        vm.stopPrank();
        assertEq(book.flagOf(spender, alice), 4);
        assertEq(book.totalFlags(), 1);
    }

    function test_flag_validation() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.BadReason.selector, 0));
        book.flag(spender, 0);
        vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.BadReason.selector, 7));
        book.flag(spender, 7);
        vm.expectRevert(NulloSpenderLabels.ZeroSpender.selector);
        book.flag(address(0), 1);
        vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.NotFlagged.selector, spender));
        book.unflag(spender);
        vm.expectRevert(NulloSpenderLabels.SelfFlag.selector);
        book.flag(alice, 1);
        vm.stopPrank();
    }

    function test_flagsNeverTouchLabels() public {
        vm.prank(alice);
        book.setLabel(spender, "Router", 1, "");
        for (uint160 i = 1; i <= 20; i++) {
            vm.prank(address(i * 1000));
            book.flag(spender, 1);
        }
        assertEq(book.getLabel(spender, alice).name, "Router");
        assertEq(book.labelsOf(spender, 0, 10).length, 1);
    }

    // ------------------------------------------------------------ pages and misc

    function test_pageLimit() public {
        vm.expectRevert(NulloSpenderLabels.PageTooLarge.selector);
        book.labelsOf(spender, 0, 101);
        vm.expectRevert(NulloSpenderLabels.PageTooLarge.selector);
        book.spendersFrom(0, 101);
        vm.expectRevert(NulloSpenderLabels.PageTooLarge.selector);
        book.spendersLabelledBy(alice, 0, 101);
        assertEq(book.spendersFrom(0, 100).length, 0);
    }

    function test_spendersFrom_order() public {
        vm.prank(alice);
        book.flag(other, 1);
        vm.prank(alice);
        book.setLabel(spender, "x", 1, "");
        address[] memory s = book.spendersFrom(0, 10);
        assertEq(s.length, 2);
        assertEq(s[0], other);
        assertEq(s[1], spender);
    }

    function test_rejectsEther() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(book).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(book).balance, 0);
    }

    function test_chainBlock_fallsBackOffArbitrum() public {
        vm.roll(1234);
        assertEq(book.chainBlock(), 1234);
    }

    function test_chainBlock_readsArbSys() public {
        // A stand-in precompile that answers arbBlockNumber() with a fixed number.
        vm.etch(address(0x64), hex"6305f5e10060005260206000f3");
        assertEq(book.chainBlock(), 100_000_000);
    }

    function test_chainBlock_brokenArbSysFallsBack() public {
        vm.etch(address(0x64), hex"fe");
        vm.roll(77);
        assertEq(book.chainBlock(), 77);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_nameRule(bytes memory raw) public {
        vm.assume(raw.length > 0 && raw.length <= 40);
        bool ok = raw.length <= 32 && raw[0] != 0x20 && raw[raw.length - 1] != 0x20;
        for (uint256 i = 0; i < raw.length && ok; i++) if (raw[i] < 0x20 || raw[i] > 0x7e) ok = false;
        vm.prank(alice);
        if (!ok) vm.expectRevert(NulloSpenderLabels.BadName.selector);
        book.setLabel(spender, string(raw), 1, "");
    }

    function testFuzz_categoryAndReason(uint8 category, uint8 reason) public {
        vm.startPrank(alice);
        if (category == 0 || category > 8) vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.BadCategory.selector, category));
        book.setLabel(spender, "x", category, "");
        if (reason == 0 || reason > 6) vm.expectRevert(abi.encodeWithSelector(NulloSpenderLabels.BadReason.selector, reason));
        book.flag(spender, reason);
        vm.stopPrank();
    }

    function testFuzz_labelRemoveCycle(address who, uint8 cat) public {
        vm.assume(who != address(0));
        cat = uint8(bound(cat, 1, 8));
        vm.startPrank(who);
        book.setLabel(spender, "n", cat, "");
        book.removeLabel(spender);
        book.setLabel(spender, "n", cat, "");
        vm.stopPrank();
        (uint32 labels,, uint32[9] memory c,) = _counts(spender);
        assertEq(labels, 1);
        assertEq(c[cat], 1);
    }
}
