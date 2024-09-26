#!/usr/bin/env node
import { select } from "@inquirer/prompts";
import path from "path";
import fs from "fs/promises";
import PackageJson from "@npmcli/package-json";

type VersionType = "major" | "minor" | "patch";

const versionType: VersionType = await select({
  message: "Select a version",
  choices: [
    {
      name: "Major",
      value: "major",
      description: "Major version",
    },
    {
      name: "Minor",
      value: "minor",
      description: "Minor version",
    },
    {
      name: "Patch",
      value: "patch",
      description: "Patch version",
    },
  ],
});

const files = await searchFile(process.cwd(), "package.json");
const currentVersion = await getCurrentVersion(files);
await bumpVersions(files, currentVersion, versionType);

async function bumpVersions(
  pkgJsonPaths: string[],
  currentVersion: string,
  versionType: VersionType,
) {
  const nextVersion = getNextVersion(currentVersion, versionType);

  for (const pkgJsonPath of pkgJsonPaths) {
    const pkgJson = await PackageJson.load(
      pkgJsonPath.replace("package.json", ""),
    );
    pkgJson.update({ version: nextVersion });
    await pkgJson.save();
  }
}

function getNextVersion(currentVersion: string, versionType: VersionType) {
  const [major, minor, patch] = parseVersion(currentVersion);
  switch (versionType) {
    case "major": {
      return [major + 1, minor, patch].join(".");
    }
    case "minor": {
      return [major, minor + 1, patch].join(".");
    }

    case "patch": {
      return [major, minor, patch + 1].join(".");
    }
  }
}

function parseVersion(version: string) {
  return version.split(".").map(Number);
}

async function getCurrentVersion(pkgJsonPaths: string[]) {
  const versions: { version: string; name: string; path: string }[] = [];
  for (const pkgJsonPath of pkgJsonPaths) {
    const buf = await fs.readFile(pkgJsonPath);
    const pkg = JSON.parse(buf.toString("utf-8")) as {
      version: string;
      name: string;
    };
    versions.push({ version: pkg.version, name: pkg.name, path: pkgJsonPath });
  }

  const [first] = versions;

  if (!versions.every((ver) => ver.version === first.version)) {
    console.log("Version mismatch.");

    for (const pkg of versions) {
      console.log(`${pkg.name}: ${pkg.version} -> ${pkg.path}`);
    }

    console.log();
    console.log(
      "All packages must be the same version before running bump-version",
    );

    process.exit(1);
  }

  return first.version;
}

async function searchFile(
  rootDir: string,
  fileName: string,
): Promise<string[]> {
  const files = await fs.readdir(rootDir);
  const filePaths: string[] = [];

  for (const file of files) {
    const filePath = path.join(rootDir, file);
    const fileStat = await fs.stat(filePath);

    if (fileStat.isDirectory() && file !== "node_modules") {
      const paths = await searchFile(filePath, fileName);
      filePaths.push(...paths);
    } else if (file.endsWith(fileName)) {
      filePaths.push(filePath);
    }
  }

  return filePaths;
}
