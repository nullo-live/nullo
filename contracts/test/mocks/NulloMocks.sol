// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal token stand-ins for the local end-to-end run (never deployed to a public chain).
contract MockToken {
    string public name = "Mock Dollar";
    string public symbol = "MOCK";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor() {
        balanceOf[msg.sender] = 1_000_000e6;
        emit Transfer(address(0), msg.sender, 1_000_000e6);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
}

contract MockCollection {
    string public name = "Mock Collection";
    string public symbol = "MCOL";
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    constructor() {
        ownerOf[1] = msg.sender;
        ownerOf[2] = msg.sender;
    }

    function approve(address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == msg.sender, "not owner");
        getApproved[tokenId] = to;
        emit Approval(msg.sender, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
}
