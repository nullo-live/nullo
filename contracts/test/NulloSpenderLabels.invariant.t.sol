// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NulloSpenderLabels} from "../src/NulloSpenderLabels.sol";

/// Random label / remove / flag / unflag calls from a small set of wallets on a small set of spenders.
contract Handler is Test {
    NulloSpenderLabels public book;
    address[] public wallets;
    address[] public spenders;

    constructor(NulloSpenderLabels b) {
        book = b;
        for (uint160 i = 1; i <= 5; i++) wallets.push(address(i * 0x1111));
        for (uint160 i = 1; i <= 3; i++) spenders.push(address(i * 0xabcd00));
    }

    function walletCount() external view returns (uint256) {
        return wallets.length;
    }

    function spenderListLength() external view returns (uint256) {
        return spenders.length;
    }

    function label(uint256 w, uint256 s, uint8 cat) external {
        cat = uint8(bound(cat, 1, 8));
        vm.prank(wallets[w % wallets.length]);
        book.setLabel(spenders[s % spenders.length], "label", cat, "");
    }

    function remove(uint256 w, uint256 s) external {
        address who = wallets[w % wallets.length];
        address sp = spenders[s % spenders.length];
        if (book.getLabel(sp, who).author == address(0)) return;
        vm.prank(who);
        book.removeLabel(sp);
    }

    function flag(uint256 w, uint256 s, uint8 reason) external {
        reason = uint8(bound(reason, 1, 6));
        address who = wallets[w % wallets.length];
        address sp = spenders[s % spenders.length];
        if (book.flagOf(sp, who) != 0) return;
        vm.prank(who);
        book.flag(sp, reason);
    }

    function unflag(uint256 w, uint256 s) external {
        address who = wallets[w % wallets.length];
        address sp = spenders[s % spenders.length];
        if (book.flagOf(sp, who) == 0) return;
        vm.prank(who);
        book.unflag(sp);
    }
}

contract NulloSpenderLabelsInvariant is Test {
    NulloSpenderLabels book;
    Handler h;

    function setUp() public {
        book = new NulloSpenderLabels();
        h = new Handler(book);
        targetContract(address(h));
    }

    /// Per spender: label count == listed labels == sum of categories == wallets holding a label.
    function invariant_labelCountsAgree() public view {
        uint256 total;
        for (uint256 s = 0; s < h.spenderListLength(); s++) {
            address sp = h.spenders(s);
            (uint32 labels,, uint32[9] memory cat,) = book.countsOf(sp);
            uint256 sum;
            for (uint256 i = 1; i < 9; i++) sum += cat[i];
            assertEq(sum, labels);
            assertEq(book.labelsOf(sp, 0, 100).length, labels);
            uint256 holders;
            for (uint256 w = 0; w < h.walletCount(); w++) if (book.getLabel(sp, h.wallets(w)).author != address(0)) holders++;
            assertEq(holders, labels);
            assertEq(cat[0], 0);
            total += labels;
        }
        assertEq(total, book.totalLabels());
    }

    /// Per spender: flag count == sum of reasons == wallets with a flag; at most one flag per wallet by construction.
    function invariant_flagCountsAgree() public view {
        uint256 total;
        for (uint256 s = 0; s < h.spenderListLength(); s++) {
            address sp = h.spenders(s);
            (, uint32 flags,, uint32[7] memory why) = book.countsOf(sp);
            uint256 sum;
            for (uint256 i = 1; i < 7; i++) sum += why[i];
            assertEq(sum, flags);
            uint256 flaggers;
            for (uint256 w = 0; w < h.walletCount(); w++) if (book.flagOf(sp, h.wallets(w)) != 0) flaggers++;
            assertEq(flaggers, flags);
            assertEq(why[0], 0);
            total += flags;
        }
        assertEq(total, book.totalFlags());
    }

    /// Per author: the labelled-spenders list matches the labels the author holds.
    function invariant_authorListsAgree() public view {
        for (uint256 w = 0; w < h.walletCount(); w++) {
            address who = h.wallets(w);
            address[] memory list = book.spendersLabelledBy(who, 0, 100);
            assertEq(list.length, book.labelCountOf(who));
            for (uint256 i = 0; i < list.length; i++) assertEq(book.getLabel(list[i], who).author, who);
        }
    }

    /// The contract never holds ETH and the discovery list never exceeds the spenders touched.
    function invariant_noFundsAndBoundedList() public view {
        assertEq(address(book).balance, 0);
        assertLe(book.spenderCount(), h.spenderListLength());
    }
}
