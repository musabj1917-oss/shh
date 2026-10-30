# GitHub Codespaces setup

## Prerequisites

- A GitHub account with access to the repository
- GitHub Codespaces enabled for the organization or user account

## Setup steps

1. Open the repository in Codespaces.
2. Create a `.env` file from `.env.example`.
3. Install dependencies:

```bash
npm install
```

4. Start the API:

```bash
npm --prefix apps/api run dev
```

5. Start the mobile app in a native environment or emulator:

```bash
npm --prefix apps/mobile run start
```

## Notes

- GitHub Codespaces is the development environment only; it does not replace the React Native native build process.
- Android/iOS builds still require the standard native toolchain or emulator access.
