# REMVSCode

**REM VSCode** is a powerful extension that integrates the REM toolchain and
Rust Analyzer with Visual Studio Code to enhance Rust code refactoring
capabilities. This extension aims to provide comprehensive refactoring tools tailored
for Rust, streamlining the development process.

Currently it is in the development phase, as part of a Research Project being
conducted at the Australian National University by:
- Matthew Britton (matt.britton@anu.edu.au)
- Alex Potanin

https://marketplace.visualstudio.com/items?itemName=MatthewBritton.remvscode&ssr=false#overview

## IMPORTANT NOTE

For now, this extension is a placeholder for the eventual extension that will be
developed. The extension has limited actual refactoring capabilities, and is
mostly a proof of concept.
It requires a substantial number of programs to be installed on your system for
it to function. It will attempt to install them, however, may fail if not on
Linux. Hence, it is recommended to run the extension on a Linux system.



## Installation

REM-VSCode requires a number of components to be installed on your system for it
to function correctly. The extension will attempt to install the required
components automatically, however, this may fail if you do not have the required
permissions, or if you do not have certain pre-requisites installed. Please see
the below Operating System Specific Installation Instructions for more details.

As a general overview, the following components are required for the extension
to function, and these will be installed automatically if you do not have them
installed already:

- openssl-dev
- git
- make
- cargo (and by extension, the nightly-2025-02-08 toolchain)
- rust-src rust-std rustc-dev llvm-tools-preview rust-analyzer-preview rustfmt
- pkg-config
- opam
- dune
- coq (8.18.0 minimum)
- CHARON (https://github.com/AeneasVerif/charon)
- AENEAS (https://github.com/AeneasVerif/aeneas)

Alternatively, you can install the required components manually. This will only
work if you DO NOT have nix installed on your system. If you do, the
installation of CHARON and AENEAS will fail, as their isntallation processes
currently fail if you have nix installed.

Alternatively, you can install AENEAS using this fork of the original
respository, that has been modified to ignore the presence of nix and only
install via rustup:

https://github.com/RuleBrittonica/aeneas.git

### Linux Specific Installation Instructions

### Windows Specific Installation Instructions

On Windows, automatic installation of the required components requires
Chocolatey to be installed. Chocolatey is a package manager for Windows that allows
you to install software from the command line. You can install Chocolatey from
the following link: https://chocolatey.org/install

Once Chocolatey is isntalled, the extension can attempt to install the other
required components.

### MacOS Specific Installation Instructions

Both Homebrew and XCode Command Line Tools are required to be installed on your
system for the extension to isntall the required components. Homebrew is a
package manager for MacOS that allows you to install software from the command
line. XCode Command Line Tools are a set of tools that allow you to compile and
build tools from the command line. You can install Homebrew from the following
link:
https://brew.sh/
Once Homebrew is installed, you can install the XCode Command Line Tools by
running the following command in the terminal:

```bash
xcode-select --install
```


## Current Features

## Eventual Features

- **Refactoring**: The extension will provide a fully-fledged extract method
  refactoring tool, allowing you to extract code into a new function or
  method. The extracted code is AUTOMATICALLY verified using a combination of
  the REM toolcahing and AENEAS, and then the new function is placed below the
  existing code.
- **Static Verification**: The extension will be able to verify certain aspects
  of your code using the AENEAS toolchain. This will include writing statements
  about the code and then verifying them using AENEAS.


## Requirements

- **Visual Studio Code**: Version ^1.92.0 or higher.
- **Rust Analyzer**: Ensure Rust Analyzer is installed and configured in your
  VSCode setup.
- All other dependencies will be installed automatically by the extension, or
  you can install them manually as described above.

## Extension Settings

This extension does not currently add any VS Code settings through the `contributes.configuration` extension point.

## Known Issues

- Currently, there are no known issues. Please report any bugs or feature requests on the [GitHub repository](https://github.com/RuleBrittonica/rem-vscode).

## Release Notes

### 0.1.0

- Initial release of REM VSCode.
- Test of the build process, has NO REFACTORING CAPABILITIES.

**Enjoy using REM VSCode!**