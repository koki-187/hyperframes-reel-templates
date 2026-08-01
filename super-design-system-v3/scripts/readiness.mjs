import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assessReadiness,formatReadiness} from '../operations/readiness-check.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const json=process.argv.includes('--json');
const noExternal=process.argv.includes('--no-external');
const report=await assessReadiness({root,includeExternal:!noExternal});
console.log(json?JSON.stringify(report,null,2):formatReadiness(report));
if(report.status!=='READY')process.exitCode=2;
