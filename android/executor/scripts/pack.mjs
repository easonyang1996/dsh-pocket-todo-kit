import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staging=path.join(root,'build/executor-kit-0.1.0');fs.rmSync(staging,{recursive:true,force:true});fs.mkdirSync(staging,{recursive:true});
// Explicit allowlist excludes private keys, credentials, user data and build caches.
for(const file of ['README.md','target-jd.example.json','.gitignore','app','test','scripts','vendor/wechat-sdk-android-6.8.40.aar','vendor/wechat-sdk-android-6.8.40.pom','dist/executor.apk','dist/executor-tests.apk','dist/registration-info.json','dist/registration-info.md']){
 const target=path.join(staging,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(root,file),target,{recursive:true});
}
const zip=path.join(root,'dist/pocket-executor-kit-0.1.0.zip');fs.rmSync(zip,{force:true});execFileSync('zip',['-qr',zip,path.basename(staging)],{cwd:path.dirname(staging)});console.log(zip);
