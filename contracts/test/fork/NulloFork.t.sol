// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NulloSpenderLabels} from "../../src/NulloSpenderLabels.sol";

interface IERC20Like {
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function symbol() external view returns (string memory);
}

/// Fork test against Robinhood Chain: ArbSys answers with the chain's own block, labels work next to the real
/// Uniswap router address, and a real token's approve(spender, 0) — the call the revoke workspace prepares — clears
/// an allowance. Run: forge test --match-path test/fork/* --fork-url https://robinhood.drpc.org --evm-version cancun
contract NulloForkTest is Test {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant UNIVERSAL_ROUTER = 0x8876789976dEcBfCbBbe364623C63652db8C0904;

    function setUp() public {
        if (block.chainid != 4663) vm.skip(true);
    }

    function test_fork_chainBlockFromArbSys() public {
        NulloSpenderLabels book = new NulloSpenderLabels();
        uint64 b = book.chainBlock();
        assertGt(b, 1_000_000);
        address me = makeAddr("me");
        vm.prank(me);
        book.setLabel(UNIVERSAL_ROUTER, "Uniswap Universal Router", 1, "https://docs.uniswap.org");
        assertEq(book.labelsOf(UNIVERSAL_ROUTER, 0, 10)[0].chainBlock, b);
    }

    function test_fork_revokeCallClearsRealAllowance() public {
        address me = makeAddr("holder");
        IERC20Like t = IERC20Like(USDG);
        assertEq(t.symbol(), "USDG");
        vm.prank(me);
        t.approve(UNIVERSAL_ROUTER, type(uint256).max);
        assertEq(t.allowance(me, UNIVERSAL_ROUTER), type(uint256).max);
        vm.prank(me);
        (bool ok,) = USDG.call(abi.encodeWithSelector(IERC20Like.approve.selector, UNIVERSAL_ROUTER, 0));
        assertTrue(ok);
        assertEq(t.allowance(me, UNIVERSAL_ROUTER), 0);
    }
}
