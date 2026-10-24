import { cpSync } from 'node:fs';
// Include browser assets so npm start runs the same standalone bundle as Docker.
cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
