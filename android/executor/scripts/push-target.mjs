import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2), file=args[0], serial=args[1];
if(!file){console.error('Usage: node scripts/push-target.mjs launch.json [device-serial]');process.exit(1);}
const text=fs.readFileSync(file,'utf8'), data=JSON.parse(text);
if(text.length>16384||data.kind!=='wechat_mini_program'||!/^gh_[A-Za-z0-9]{1,100}$/.test(data.userName||''))throw Error('Expected mini-program launch JSON');
const adb=process.env.ADB||path.join(process.env.ANDROID_SDK_ROOT||path.join(os.homedir(),'Library/Android/sdk'),'platform-tools/adb');
const command=[...(serial?['-s',serial]:[]),'shell','am','start','-W','-n','com.personalai.pocketexecutor/.MainActivity','--es','target_b64',Buffer.from(text).toString('base64url')];
process.stdout.write(execFileSync(adb,command,{encoding:'utf8'}));
console.log('已导入执行器；请在手机上检查参数并点击 OpenSDK 拉起按钮。');
