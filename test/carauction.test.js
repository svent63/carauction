const { assert, expect } = require("chai")
const { deployments, getNamedAccounts, ethers } = require("hardhat")

describe("CarAuction", async () => {
    let carAuction
    let deployer

    beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        carAuction = await ethers.getContract("CarAuction", deployer)
    })

    describe("constructor", async () => {
        it("has a reserved price", async () => {
            const reservedPrice = await carAuction.getReservedPrice()
            assert.equal(reservedPrice.toString(), ethers.utils.parseEther("0.002").toString())
        })
    })

    describe("enterAuction", async () => {
        it("reverts if not enough ETH spent", async () => {
            await expect(carAuction.enterAuction()).to.be.revertedWithCustomError(
                carAuction,
                "CarAuction__LessThanReservedAmount"
            )
        })

        it("the bid is recorder", async () => {
            const expected = ethers.utils.parseEther("0.03")
            await carAuction.enterAuction({ value: expected })
            const response = await carAuction.getHighestBid()
            assert.equal(response.toString(), expected.toString())
        })

        it("highest bid is updated with higher bid", async () => {
            const initialBid = ethers.utils.parseEther("0.03")
            await carAuction.enterAuction({ value: initialBid })
            const higherBid = ethers.utils.parseEther("0.04")
            await carAuction.enterAuction({ value: higherBid })
            const response = await carAuction.getHighestBid()
            assert.equal(higherBid.toString(), response.toString())
        })

        it("it record the number of bidders", async () => {
            const initialBid = ethers.utils.parseEther("0.03")
            await carAuction.enterAuction({ value: initialBid })
            const higherBid = ethers.utils.parseEther("0.04")
            await carAuction.enterAuction({ value: higherBid })
            const response = await carAuction.getParticipantsCount()
            assert.equal(response.toString(), "2")
        })

        it("disallows funds to be withdrawn while the auction is in progress", async () => {
            const accounts = await ethers.getSigners()
            const accountOne = await carAuction.connect(accounts[1])
            await accountOne.enterAuction({ value: ethers.utils.parseEther("0.024") })
            await expect(accountOne.withdrawBid()).to.be.revertedWithCustomError(
                carAuction,
                "CarAuction__AuctionStillInProgress"
            )
        })
    })

    describe("completeAuction", async () => {
        const highest = ethers.utils.parseEther("0.04")
        beforeEach(async () => {
            const accounts = await ethers.getSigners()
            const initialBid = ethers.utils.parseEther("0.03")

            const bidderOne = await carAuction.connect(accounts[1])
            await bidderOne.enterAuction({ value: initialBid })

            const bidderTwo = await carAuction.connect(accounts[2])
            await bidderTwo.enterAuction({ value: highest })
        })

        it("transfer the highest bid amount to the owner account", async () => {
            const deployerBalance = await carAuction.provider.getBalance(deployer)

            const transactionResponse = await carAuction.completeAuction()
            const transactionReceipt = await transactionResponse.wait(1)

            const { gasUsed, effectiveGasPrice } = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingBalance = await carAuction.provider.getBalance(deployer)
            assert.equal(deployerBalance.add(highest).sub(gasCost).toString(), endingBalance.toString())
        })

        it("sets the variable indicating the the auction is over", async () => {
            await carAuction.completeAuction()
            assert.ok(await carAuction.isAuctionOver())
        })

        it("prevent new entrance to the auction", async () => {
            await carAuction.completeAuction()
            await expect(carAuction.enterAuction()).to.be.revertedWithCustomError(
                carAuction,
                "CarAuction__AuctionIsOver"
            )
        })
    })

    describe("withdraw", async () => {
        let bidderOne
        let bidderTwo
        let bidderThree

        beforeEach(async () => {
            const accounts = await ethers.getSigners()

            bidderOne = await carAuction.connect(accounts[1])
            await bidderOne.enterAuction({ value: ethers.utils.parseEther("0.025") })

            bidderTwo = await carAuction.connect(accounts[2])

            bidderThree = await carAuction.connect(accounts[3])
            await bidderThree.enterAuction({ value: ethers.utils.parseEther("0.04") })

            const transactionResponse = await carAuction.completeAuction()
            await transactionResponse.wait(1)
        })

        it("allows loosing bidders to withdraw their funds", async () => {
            const transactionResponse = await bidderOne.withdrawBid()
            await transactionResponse.wait(1)
            const bidderOneEndBalance = await carAuction.provider.getBalance(bidderOne.address)
            assert.equal(bidderOneEndBalance.toString(), "0")
        })

        it("disallows non participants from withdrawing funds", async () => {
            await expect(bidderTwo.withdrawBid()).to.be.revertedWithCustomError(carAuction, "CarAuction__NotABidder")
        })
    })
})
