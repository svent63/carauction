const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const args = ["Ford", "Figo", "Blue", 2010, true, ethers.utils.parseEther("0.002")]
    const carAuction = await deploy("CarAuction", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockChainConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(carAuction.address, args)
    }

    log("Contract deployed")
    log("--------------------------------------------------------")
}

module.exports.tags = ["all", "car-auction"]
