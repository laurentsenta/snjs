import { Features } from './dist/Domain/Feature/Features.js';

import { promises as fs } from 'fs';
import path from 'path';

const filePath = path.join('./dist/Domain/Feature/features.json');
await fs.writeFile(filePath, JSON.stringify(Features, undefined, 2));