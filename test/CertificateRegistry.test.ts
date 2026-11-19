import { expect } from "chai";
import { ethers } from "hardhat";

describe("CertificateRegistry", function () {
  async function deployRegistry() {
    const [owner, recipient, other, newAdmin] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CertificateRegistry");
    const registry = await factory.deploy();
    await registry.waitForDeployment();
    return { registry, owner, recipient, other, newAdmin };
  }

  function certificate(id: string) {
    return {
      name: `Étudiant ${id}`,
      studentId: id,
      diploma: "Licence Informatique",
      date: "2025-06-30",
      grade: "Bien"
    };
  }

  async function mintBatch(registry: any, recipient: string, count: number, prefix = "BATCH") {
    const entries = Array.from({ length: count }, (_, index) => certificate(`${prefix}-${index}`));
    return registry.batchMint(
      entries.map(() => recipient),
      entries.map((entry) => entry.name),
      entries.map((entry) => entry.studentId),
      entries.map((entry) => entry.diploma),
      entries.map((entry) => entry.date),
      entries.map((entry) => entry.grade)
    );
  }

  it("sets the deployer as owner and administrator", async function () {
    const { registry, owner } = await deployRegistry();
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.isAdmin(owner.address)).to.equal(true);
  });

  it("mints and reads a certificate with an event", async function () {
    const { registry, recipient } = await deployRegistry();
    const item = certificate("CNE-1");
    await expect(registry.mintCertificate(recipient.address, item.name, item.studentId, item.diploma, item.date, item.grade))
      .to.emit(registry, "CertificateMinted")
      .withArgs(1, item.studentId, recipient.address, item.name, item.diploma, item.date, item.grade);
    const saved = await registry.getCertificate(1);
    expect(saved.studentName).to.equal(item.name);
    expect(saved.studentId).to.equal(item.studentId);
    expect(saved.diplomaTitle).to.equal(item.diploma);
    expect(saved.issueDate).to.equal(item.date);
    expect(saved.grade).to.equal(item.grade);
    expect(saved.recipient).to.equal(recipient.address);
    expect(saved.revoked).to.equal(false);
    expect(await registry.getCertIdByStudentId(item.studentId)).to.equal(1);
  });

  it("rejects minting by a non-admin", async function () {
    const { registry, other, recipient } = await deployRegistry();
    const item = certificate("CNE-2");
    await expect(registry.connect(other).mintCertificate(recipient.address, item.name, item.studentId, item.diploma, item.date, item.grade))
      .to.be.revertedWithCustomError(registry, "NotAdmin");
  });

  it("rejects duplicate student IDs for single and batch minting, including within a batch", async function () {
    const { registry, recipient } = await deployRegistry();
    const item = certificate("DUP-1");
    await registry.mintCertificate(recipient.address, item.name, item.studentId, item.diploma, item.date, item.grade);
    await expect(registry.mintCertificate(recipient.address, item.name, item.studentId, item.diploma, item.date, item.grade))
      .to.be.revertedWithCustomError(registry, "DuplicateStudentId");

    const repeated = [certificate("BATCH-DUP"), certificate("BATCH-DUP")];
    await expect(registry.batchMint(
      repeated.map(() => recipient.address),
      repeated.map((entry) => entry.name),
      repeated.map((entry) => entry.studentId),
      repeated.map((entry) => entry.diploma),
      repeated.map((entry) => entry.date),
      repeated.map((entry) => entry.grade)
    )).to.be.revertedWithCustomError(registry, "DuplicateStudentId");

    const oneExisting = [certificate("NEW-1"), certificate("DUP-1")];
    await expect(registry.batchMint(
      oneExisting.map(() => recipient.address),
      oneExisting.map((entry) => entry.name),
      oneExisting.map((entry) => entry.studentId),
      oneExisting.map((entry) => entry.diploma),
      oneExisting.map((entry) => entry.date),
      oneExisting.map((entry) => entry.grade)
    )).to.be.revertedWithCustomError(registry, "DuplicateStudentId");
    expect(await registry.totalCertificates()).to.equal(1);
  });

  it("mints batches and rejects mismatched or oversized batches", async function () {
    const { registry, recipient } = await deployRegistry();
    const item = certificate("BATCH-OK");
    await registry.batchMint(
      [recipient.address, recipient.address],
      [item.name, item.name],
      ["BATCH-OK-1", "BATCH-OK-2"],
      [item.diploma, item.diploma],
      [item.date, item.date],
      [item.grade, item.grade]
    );
    expect(await registry.totalCertificates()).to.equal(2);
    expect((await registry.getCertificate(2)).studentId).to.equal("BATCH-OK-2");

    await expect(registry.batchMint([recipient.address], [], ["X"], [item.diploma], [item.date], [item.grade]))
      .to.be.revertedWithCustomError(registry, "InvalidArrayLengths");

    const tooMany = Array.from({ length: 16 }, (_, index) => certificate(`TOO-MANY-${index}`));
    await expect(registry.batchMint(
      tooMany.map(() => recipient.address),
      tooMany.map((entry) => entry.name),
      tooMany.map((entry) => entry.studentId),
      tooMany.map((entry) => entry.diploma),
      tooMany.map((entry) => entry.date),
      tooMany.map((entry) => entry.grade)
    )).to.be.revertedWithCustomError(registry, "BatchTooLarge").withArgs(16, 15);
  });

  it("rejects empty mandatory fields and a zero recipient", async function () {
    const { registry, recipient } = await deployRegistry();
    await expect(registry.mintCertificate(recipient.address, "", "ID", "Diploma", "2025-01-01", "Bien"))
      .to.be.revertedWithCustomError(registry, "EmptyRequiredField");
    await expect(registry.mintCertificate(recipient.address, "Nom", "   ", "Diploma", "2025-01-01", "Bien"))
      .to.be.revertedWithCustomError(registry, "EmptyRequiredField");
    await expect(registry.mintCertificate(ethers.ZeroAddress, "Nom", "ID", "Diploma", "2025-01-01", "Bien"))
      .to.be.revertedWithCustomError(registry, "InvalidRecipient");
  });

  it("revokes once, and restricts revocation to admins", async function () {
    const { registry, recipient, other } = await deployRegistry();
    const item = certificate("REVOKE-1");
    await registry.mintCertificate(recipient.address, item.name, item.studentId, item.diploma, item.date, item.grade);
    await expect(registry.connect(other).revoke(1)).to.be.revertedWithCustomError(registry, "NotAdmin");
    await expect(registry.revoke(1)).to.emit(registry, "CertificateRevoked").withArgs(1);
    expect((await registry.getCertificate(1)).revoked).to.equal(true);
    await expect(registry.revoke(1)).to.be.revertedWithCustomError(registry, "AlreadyRevoked");
  });

  it("reverts for a nonexistent certificate", async function () {
    const { registry } = await deployRegistry();
    await expect(registry.getCertificate(0)).to.be.revertedWithCustomError(registry, "CertificateNotFound");
    await expect(registry.getCertificate(1)).to.be.revertedWithCustomError(registry, "CertificateNotFound");
  });

  it("allows only the owner to add and remove admins", async function () {
    const { registry, newAdmin, other } = await deployRegistry();
    await expect(registry.connect(other).addAdmin(newAdmin.address)).to.be.revertedWithCustomError(registry, "NotOwner");
    await expect(registry.addAdmin(newAdmin.address)).to.emit(registry, "AdminUpdated").withArgs(newAdmin.address, true);
    expect(await registry.isAdmin(newAdmin.address)).to.equal(true);
    await expect(registry.removeAdmin(newAdmin.address)).to.emit(registry, "AdminUpdated").withArgs(newAdmin.address, false);
    expect(await registry.isAdmin(newAdmin.address)).to.equal(false);
  });

  it("reports gas for batches of 5, 10, and 15 certificates", async function () {
    const { registry, recipient } = await deployRegistry();
    for (const count of [5, 10, 15]) {
      const tx = await mintBatch(registry, recipient.address, count, `GAS-${count}`);
      const receipt = await tx.wait();
      console.log(`  batchMint(${count}) gas used: ${receipt!.gasUsed.toString()}`);
    }
  });
});
