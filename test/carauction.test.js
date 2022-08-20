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
        let bidderOneBalance
        let bidderTwoBalance
        let bidderThreeBalance

        beforeEach(async () => {
            const accounts = await ethers.getSigners()

            const bidderOne = await carAuction.connect(accounts[1])
            await bidderOne.enterAuction({ value: ethers.utils.parseEther("0.02") })
            const bidderTwo = await carAuction.connect(accounts[2])
            await bidderTwo.enterAuction({ value: ethers.utils.parseEther("0.03") })
            const bidderThree = await carAuction.connect(accounts[3])
            await bidderThree.enterAuction({ value: ethers.utils.parseEther("0.04") })
        })
    })
})
