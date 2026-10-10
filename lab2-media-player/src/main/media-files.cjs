"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { isSupportedMediaFile } = require("../shared/formats.js");

function collectMediaArgs(args) {
  return args
    .filter((arg) => !arg.startsWith("-") && isSupportedMediaFile(arg))
    .map((arg) => path.resolve(arg));
}

function toMediaDescriptor(filePath) {
  return { name: path.basename(filePath), url: pathToFileURL(filePath).href };
}

module.exports = { collectMediaArgs, toMediaDescriptor };
