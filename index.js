// @ts-check
import dns from "node:dns";
import net from "node:net";
import * as core from "@actions/core";
import { HttpClient } from "@actions/http-client";
import { delay } from "./utils/promise.js";
import { toJson } from "./utils/json.js";

// Loopback/private/link-local ranges (e.g. cloud metadata endpoints such as
// 169.254.169.254) that requests must never be allowed to reach, to mitigate
// server-side request forgery. `BlockList` natively matches IPv4-mapped IPv6
// addresses (e.g. `::ffff:127.0.0.1`) against the ipv4 rules too.
const disallowedAddresses = new net.BlockList();
for (const [address, prefix] of [
  ["127.0.0.0", 8],
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["169.254.0.0", 16],
  ["0.0.0.0", 8],
]) {
  disallowedAddresses.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::1", 128],
  ["::", 128],
  ["fc00::", 7],
  ["fe80::", 10],
]) {
  disallowedAddresses.addSubnet(address, prefix, "ipv6");
}

// Custom DNS lookup used for the actual TCP connection (via the handler below), rather
// than a one-off hostname check beforehand. Validating the exact address that Node is
// about to connect to - for the original request and every redirect it follows - closes
// the DNS-rebinding gap that a separate preflight resolution would leave open.
const safeLookup = (hostname, options, callback) => {
  // Node passes IPv6 literals through with brackets still attached (e.g. "[::1]").
  const strippedHostname = hostname.replace(/^\[|\]$/g, "");
  const wantsAll = typeof options === "object" && options !== null && options.all === true;

  dns.lookup(strippedHostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);

    for (const { address, family } of addresses) {
      if (disallowedAddresses.check(address, family === 6 ? "ipv6" : "ipv4")) {
        return callback(
          new Error(`Resolved address '${address}' for host '${hostname}' is not allowed.`),
        );
      }
    }

    if (wantsAll) return callback(null, addresses);

    const [{ address, family }] = addresses;
    callback(null, address, family);
  });
};

const safeLookupHandler = {
  prepareRequest: (options) => {
    options.lookup = safeLookup;

    // Node connects directly to a literal IP address (e.g. "169.254.169.254") without
    // ever calling the custom `lookup` above, so that case needs its own direct check here.
    // Bracketed IPv6 literals (how `URL.hostname` renders them) don't hit this shortcut and
    // go through `safeLookup` as usual.
    const family = net.isIP(options.host);
    if (family && disallowedAddresses.check(options.host, family === 6 ? "ipv6" : "ipv4")) {
      throw new Error(`Address '${options.host}' is not allowed.`);
    }
  },
  canHandleAuthentication: () => false,
  handleAuthentication: () => {
    throw new Error("Authentication handling is not supported.");
  },
};

const main = async () => {
  const http = new HttpClient(undefined, [safeLookupHandler]);

  // Get the inputs
  const inputs = {
    url: core.getInput("url"),
    method: core.getInput("method"),
    headers: Object.fromEntries(
      // Turn the array of string headers into an array of key-value pairs
      core.getMultilineInput("headers").map((header) => header.split(":", 2).map((s) => s.trim())),
    ),
    body: core.getInput("body"),
    retryCount: Number(core.getInput("retry-count")),
    retryDelay: Number(core.getInput("retry-delay")),
    failOnError: core.getBooleanInput("fail-on-error"),
  };

  core.info(`Inputs: ${toJson(inputs)}`);

  const parsedUrl = new URL(inputs.url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(`URL '${inputs.url}' is not allowed.`);
  }

  let remainingRetryCount = inputs.retryCount;
  while (true) {
    // Make the request
    const response = await http.request(inputs.method, inputs.url, inputs.body, inputs.headers);
    const responseSuccess = response.message.statusCode && response.message.statusCode < 400;

    // Check for errors
    if (!responseSuccess) {
      // Retry if possible
      if (remainingRetryCount > 0) {
        core.warning(
          `Request failed with status code ${response.message.statusCode}. Retries remaining: ${remainingRetryCount}.`,
        );

        if (inputs.retryDelay > 0) {
          core.info(`Delaying for ${inputs.retryDelay}ms...`);
          await delay(inputs.retryDelay);
        }

        remainingRetryCount--;
        continue;
      }
      // Otherwise, fail or warn about the error
      else {
        if (inputs.failOnError) {
          core.setFailed(
            `Request failed with status code ${response.message.statusCode}. No retries remaining.`,
          );
        } else {
          core.warning(
            `Request failed with status code ${response.message.statusCode}. No retries remaining.`,
          );
        }
      }
    }

    // Read the body
    const responseBody = await response.readBody();

    // Set the outputs
    const outputs = {
      status: response.message.statusCode,
      success: responseSuccess,
      headers: Object.fromEntries(
        Object.entries(response.message.headers)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]),
      ),
      body: responseBody,
    };

    core.info(`Outputs: ${toJson(outputs)}`);

    core.setOutput("status", outputs.status);
    core.setOutput("success", outputs.success);
    core.setOutput("headers", toJson(outputs.headers));
    core.setOutput("body", outputs.body);

    // Break out of the retry loop
    break;
  }
};

main().catch((error) => core.setFailed(error));
