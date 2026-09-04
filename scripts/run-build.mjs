import {spawn} from "node:child_process";
import path from "node:path";

const executable=path.resolve("node_modules","vinext","dist","cli.js");
const child=spawn(process.execPath,[executable,"build"],{stdio:"inherit",env:{...process.env,WRANGLER_LOG_PATH:process.env.WRANGLER_LOG_PATH??".wrangler/wrangler.log"}});
const timer=setTimeout(()=>{console.error("BrickForge build exceeded the 3 minute safety limit.");child.kill("SIGTERM")},180_000);
child.on("exit",code=>{clearTimeout(timer);process.exitCode=code??1});
