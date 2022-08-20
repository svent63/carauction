// SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

import "hardhat/console.sol";

contract CarAuction {
    struct ItemForAuction {
        string make;
        string model;
        string color;
        uint16 year;
        bool serviceHistory;
        uint256 reservedPrice;
    }

    address private immutable i_owner;
    uint256 private immutable i_reservedPrice;
    bool private s_auctionIsOver;
    address[] private s_biddersAddress;
    mapping(address => uint256) private s_bidders;
    ItemForAuction public s_itemForAuction;
    address private s_highestBiddersAddress;
    uint256 private s_highestBidAmount;

    error CarAuction__OnlyOwner();
    error CarAuction__LessThanReservedAmount();
    error CarAuction__NotABidder();
    error CarAuction__AuctionStillInProgress();
    error CarAuction__AuctionIsOver();

    modifier auctionInProgress() {
        if (s_auctionIsOver == false) {
            revert CarAuction__AuctionStillInProgress();
        }
        _;
    }

    modifier auctionCompleted() {
        if (s_auctionIsOver == true) {
            revert CarAuction__AuctionIsOver();
        }
        _;
    }

    constructor(
        string memory make,
        string memory model,
        string memory color,
        uint16 year,
        bool fullService,
        uint256 reservedPrice
    ) {
        i_owner = msg.sender;
        i_reservedPrice = reservedPrice;

        s_itemForAuction.make = make;
        s_itemForAuction.model = model;
        s_itemForAuction.color = color;
        s_itemForAuction.year = year;
        s_itemForAuction.serviceHistory = fullService;
        s_itemForAuction.reservedPrice = reservedPrice;
    }

    /**
     * Function adds the caller to the auction, the function also check if the
     * entered amount is higher that the previous highest value, if found to be
     * the case then the senders address and amount is stored as the new highest
     * amount.
     *
     * At the end of the auction the contract will use the highest bidder details
     * as the winner of the auction.
     */
    function enterAuction() public payable auctionCompleted {
        if (msg.value < i_reservedPrice) {
            revert CarAuction__LessThanReservedAmount();
        }

        address bidderAddress = msg.sender;
        s_bidders[bidderAddress] = msg.value;
        s_biddersAddress.push(bidderAddress);

        if (msg.value > s_highestBidAmount) {
            s_highestBidAmount = msg.value;
            s_highestBiddersAddress = msg.sender;
        }
    }

    /**
     * At the end of the auction the loosing bidders is allowd to
     * withdraw their bids, they however will pay the gas cost. If
     * a loosing bidder withdrawed their funds and try to do so again
     * they will incure and additional gas fee but no funds will be
     * returned.
     */
    function withdrawBid() public auctionInProgress {
        address[] memory allBidders = s_biddersAddress;
        for (uint256 idx = 0; idx < allBidders.length; idx++) {
            if (msg.sender == allBidders[idx]) {
                uint256 amount = s_bidders[msg.sender];
                s_bidders[msg.sender] = 0;
                payable(msg.sender).transfer(amount);
                return;
            }
        }

        revert CarAuction__NotABidder();
    }

    /**
     * This function is called from a Chainlink Keepers contract,
     * signalling the end of the auction. The amount of the highest
     * bidder will the transafered to the owner of the contract.
     */
    function completeAuction() public {
        s_auctionIsOver = true;
        uint256 amount = s_bidders[s_highestBiddersAddress];
        s_bidders[s_highestBiddersAddress] = 0;
        payable(i_owner).transfer(amount);
    }

    function getReservedPrice() public view returns (uint256) {
        return i_reservedPrice;
    }

    function getParticipantsCount() public view returns (uint256) {
        return s_biddersAddress.length;
    }

    function getHighestBid() public view returns (uint256) {
        return s_highestBidAmount;
    }

    function isAuctionOver() public view returns (bool) {
        return s_auctionIsOver;
    }
}
