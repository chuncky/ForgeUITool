#!/usr/bin/env node
import { runStdioMcpServer } from "./stdio-server.js";

runStdioMcpServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
