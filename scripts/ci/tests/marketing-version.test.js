"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const path = require("node:path");

const { marketingVersion } = require("../marketing-version");

const SCRIPT = path.join(__dirname, "..", "marketing-version.js");

test("plain version is unchanged", () => {
  assert.equal(marketingVersion("1.2.3"), "1.2.3");
});

test("prerelease suffix is stripped", () => {
  assert.equal(marketingVersion("0.3.2-alpha.1"), "0.3.2");
});

test("prerelease and build metadata are both stripped", () => {
  assert.equal(marketingVersion("2.1.0-rc.1+meta"), "2.1.0");
});

test("build metadata alone is stripped", () => {
  assert.equal(marketingVersion("1.0.0+build.5"), "1.0.0");
});

test("a prerelease and its final release share one marketing version", () => {
  assert.equal(marketingVersion("0.3.2-alpha.1"), marketingVersion("0.3.2"));
});

test("one and two component versions are accepted", () => {
  assert.equal(marketingVersion("3"), "3");
  assert.equal(marketingVersion("3.4-beta"), "3.4");
});

test("surrounding whitespace is ignored", () => {
  assert.equal(marketingVersion(" 1.2.3-rc.1 \n"), "1.2.3");
});

test("malformed values throw", () => {
  for (const bad of ["", "abc", "v1.2.3", "1.2.3.4", "1..2", "-rc.1", "1.2.x", "latest"]) {
    assert.throws(() => marketingVersion(bad), /Cannot derive an iOS marketing version/, bad);
  }
});

test("non-string input throws", () => {
  assert.throws(() => marketingVersion(undefined), /must be a string/);
  assert.throws(() => marketingVersion(123), /must be a string/);
});

test("CLI prints the numeric version", () => {
  const out = execFileSync("node", [SCRIPT, "1.4.0-alpha.2"], { encoding: "utf8" });
  assert.equal(out, "1.4.0\n");
});

test("CLI fails loudly on a malformed version", () => {
  const res = spawnSync("node", [SCRIPT, "not-a-version"], { encoding: "utf8" });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /^::error::Cannot derive an iOS marketing version/);
  assert.equal(res.stdout, "");
});

test("CLI fails without an argument", () => {
  const res = spawnSync("node", [SCRIPT], { encoding: "utf8" });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Usage/);
});
