import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, { upgrades, ethers } from "hardhat";

const CHAIN_ID = 31337;
const MAX_SUPPLY = Math.pow(10, 6) * 10000;

describe("PointCoin", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, singer1, singer2, singer3] = await hre.ethers.getSigners();

    const PointCoin = await hre.ethers.getContractFactory("PointCoin");
    const PointCoinProxy = await upgrades.deployProxy(
      PointCoin,
      [
        owner.address,
        MAX_SUPPLY,
        "RedotPay Point Coin",
        "RPC",
        6,
        [singer1.address, singer2.address, singer3.address],
        owner.address,
      ],
      {
        initializer:
          "initalize(address,uint256,string,string,uint8,address[],address)",
      }
    );
    await PointCoinProxy.waitForDeployment();

    console.log(`PointCoin deployed at: ${PointCoinProxy.target}  `);

    // return { lock, unlockTime, lockedAmount, owner, otherAccount };
    return { PointCoinProxy, owner, singer1, singer2, singer3 };
  }

  function getPointCoin(contract: any, singer: any) {
    const result = new ethers.Contract(
      contract.target,
      contract.interface,
      singer
    );
    return result;
  }

  async function signMint(
    orderId: string,
    account: string,
    amount: number,
    expireTime: number,
    contractAddress: string,
    signer: any
  ) {
    const packedParams = ethers.solidityPacked(
      ["string", "uint256", "address", "uint256", "uint256", "address"],
      [orderId, CHAIN_ID, account, amount, expireTime, contractAddress]
    );
    const hashString = ethers.keccak256(packedParams);
    const signature = await signer.signMessage(ethers.toBeArray(hashString));
    return signature;
  }

  describe("Deployment", function () {
    it("check owner", async function () {
      const { PointCoinProxy, owner, singer1, singer2, singer3 } =
        await loadFixture(deployOneYearLockFixture);

      const contract = getPointCoin(PointCoinProxy, owner);
      expect(await contract.owner()).equal(owner.address);
    });

    it("check max supply", async function () {
      const { PointCoinProxy, owner, singer1, singer2, singer3 } =
        await loadFixture(deployOneYearLockFixture);

      const contract = getPointCoin(PointCoinProxy, owner);
      expect(await contract.maxSupply()).equal(MAX_SUPPLY);
    });
  });

  describe("Mint", function () {
    it("invalid signers length", async function () {
      const { PointCoinProxy, owner, singer1, singer2, singer3 } =
        await loadFixture(deployOneYearLockFixture);

      const contract = getPointCoin(PointCoinProxy, owner);
      const orderId = "order_id";
      const account = owner.address;
      const amount = Math.pow(10, 6) * 1000;
      const expireTime = 2_000_000_000;
      const signers = [singer1.address];
      const signatures: any = [];
      /**
        string memory orderId,
        address account,
        uint256 amount,
        uint256 expireTime,
        address[] memory signers,
        bytes[] memory signatures
    */
      await expect(
        contract.mint(orderId, account, amount, expireTime, signers, signatures)
      ).to.be.revertedWith("invalid signers length");
    });

    it("maximum supply exceeded", async function () {
      const { PointCoinProxy, owner, singer1, singer2, singer3 } =
        await loadFixture(deployOneYearLockFixture);

      const contract = getPointCoin(PointCoinProxy, owner);
      const totalSupply = await contract.totalSupply();
      const maxSupply = await contract.maxSupply();

      const orderId = "order_id";
      const account = owner.address;
      const amount = Math.pow(10, 6) * 10001;
      const expireTime = 2_000_000_000;
      const signers = [singer1.address, singer2.address];
      const signatures: any = [
        await signMint(
          orderId,
          account,
          amount,
          expireTime,
          contract.target as string,
          singer1
        ),
        await signMint(
          orderId,
          account,
          amount,
          expireTime,
          contract.target as string,
          singer2
        ),
      ];
      await expect(
        contract.mint(orderId, account, amount, expireTime, signers, signatures)
      ).to.be.revertedWith("maximum supply exceeded");
    });

    it("normal mint", async function () {
      const { PointCoinProxy, owner, singer1, singer2, singer3 } =
        await loadFixture(deployOneYearLockFixture);

      const contract = getPointCoin(PointCoinProxy, owner);
      let totalSupply = await contract.totalSupply();
      let maxSupply = await contract.maxSupply();

      const orderId = "order_id";
      const account = owner.address;
      const mintAmount = Math.pow(10, 6) * 1000;
      const expireTime = 2_000_000_000;
      const signers = [singer1.address, singer2.address];
      const signatures: any = [
        await signMint(
          orderId,
          account,
          mintAmount,
          expireTime,
          contract.target as string,
          singer1
        ),
        await signMint(
          orderId,
          account,
          mintAmount,
          expireTime,
          contract.target as string,
          singer2
        ),
      ];
      await contract.mint(
        orderId,
        account,
        mintAmount,
        expireTime,
        signers,
        signatures
      );
      const balance = await contract.balanceOf(account);
      expect(balance).equal(mintAmount);

      totalSupply = await contract.totalSupply();
      console.log(`Total supply: ${totalSupply}`);
      expect(totalSupply).equal(mintAmount);

      // ============================= BURN =============================

      const burnOrderId = "burn_order_id";
      const burnAddress = await contract.burnAddress();
      const burnAmount = Math.pow(10, 6) * 100;
      const burnSignatures: any = [
        await signMint(
          burnOrderId,
          burnAddress,
          burnAmount,
          expireTime,
          contract.target as string,
          singer1
        ),
        await signMint(
          burnOrderId,
          burnAddress,
          burnAmount,
          expireTime,
          contract.target as string,
          singer2
        ),
      ];
      await contract.burn(
        burnOrderId,
        burnAmount,
        expireTime,
        signers,
        burnSignatures
      );

      totalSupply = await contract.totalSupply();
      expect(totalSupply).equal(mintAmount - burnAmount);

      const amountOfBurnAddress = await contract.balanceOf(burnAddress);
      expect(amountOfBurnAddress).equal(mintAmount - burnAmount);
    });
  });
});
