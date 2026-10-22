// AAPT2 only needs the binary manifest and resource table to resolve app labels.
// Build a small, uncompressed ZIP locally instead of transferring the full APK.
const crcTable = Array.from({length:256},(_,i)=>{let c=i;for(let b=0;b<8;b++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(data) { let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0; }
// File-valued resources are checked by AAPT2 even when only labels are needed.
// Empty local ZIP entries satisfy those references without transferring icons.
export function resourceFilePaths(data) {
  if (!data) return [];
  const refs = new Set();
  if (data.length < 12 || data.readUInt16LE(0) !== 2) throw new Error('无效 Android 资源表');
  let chunk = data.readUInt16LE(2);
  while (chunk + 8 <= data.length) {
    const type=data.readUInt16LE(chunk),header=data.readUInt16LE(chunk+2),size=data.readUInt32LE(chunk+4);
    if (size < header || header < 8 || chunk+size > data.length) throw new Error('资源表结构无效');
    if (type === 1 && header >= 28) {
      const count=data.readUInt32LE(chunk+8),utf8=!!(data.readUInt32LE(chunk+16)&0x100),start=chunk+data.readUInt32LE(chunk+20),end=chunk+size;
      if (count>1000000 || chunk+header+count*4>end) throw new Error('资源字符串表过大或无效');
      for(let i=0;i<count;i++) {
        let pos=start+data.readUInt32LE(chunk+header+i*4);
        if(pos<start || pos>=end) throw new Error('资源字符串偏移无效');
        const len8=()=>{if(pos>=end)throw new Error('资源字符串不完整');const v=data[pos++];if(!(v&128))return v;if(pos>=end)throw new Error('资源字符串不完整');return((v&127)<<8)|data[pos++];};
        const len16=()=>{if(pos+2>end)throw new Error('资源字符串不完整');const v=data.readUInt16LE(pos);pos+=2;if(!(v&32768))return v;if(pos+2>end)throw new Error('资源字符串不完整');const n=(v&32767)*65536+data.readUInt16LE(pos);pos+=2;return n;};
        let bytes;if(utf8){len8();bytes=len8();}else bytes=len16()*2;
        if(pos+bytes>end)throw new Error('资源字符串越界');
        if(bytes>2048)continue;
        const value=data.toString(utf8?'utf8':'utf16le',pos,pos+bytes);
        if(/^res\/[^\0]+$/.test(value) && value.length<=512 && !value.split('/').includes('..'))refs.add(value);
      }
      break;
    }
    chunk+=size;
  }
  if(refs.size>60000)throw new Error('资源文件引用过多');
  return [...refs];
}
export function metadataApk(manifest, resources) {
  if (!Buffer.isBuffer(manifest) || !manifest.length || manifest.length > 4*1024*1024) throw new Error('安装包 manifest 元数据无效或过大');
  if (resources && (!Buffer.isBuffer(resources) || resources.length > 64*1024*1024)) throw new Error('安装包资源表元数据无效或过大');
  const entries=[['AndroidManifest.xml',manifest],...(resources?.length?[['resources.arsc',resources],...resourceFilePaths(resources).map(name=>[name,Buffer.alloc(0)])]:[])];
  const locals=[],central=[];let offset=0;
  for(const [name,bytes]of entries){
    const filename=Buffer.from(name),crc=crc32(bytes),local=Buffer.alloc(30),directory=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);
    directory.writeUInt32LE(0x02014b50,0);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(bytes.length,20);directory.writeUInt32LE(bytes.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
    locals.push(local,filename,bytes);central.push(directory,filename);offset+=local.length+filename.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
