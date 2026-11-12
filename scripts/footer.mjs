import fs from 'node:fs';
import path from 'node:path';
import {versionedAsset} from './latest-covers.mjs';

const footerPattern=/<footer\b[^>]*class="[^"]*\bpie-pagina\b[^"]*"[^>]*>[\s\S]*?<\/footer>/;
export function sharedFooter(root){
  return fs.readFileSync(path.join(root,'templates/footer.html'),'utf8').trim();
}
export function buildSharedFooter(root){
  if(!fs.existsSync(path.join(root,'templates/footer.html')))return 0;
  const footer=sharedFooter(root);
  const stylesheet=versionedAsset(root,'/assets/pie.css')||'/assets/pie.css';
  const link='<link rel="stylesheet" href="'+stylesheet+'" data-shared-footer>';
  let updated=0;
  const visit=directory=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(entry.name.startsWith('.')||['node_modules','assets','content','scripts'].includes(entry.name))continue;
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()){visit(file);continue;}
      if(!entry.isFile()||!entry.name.endsWith('.html')||file===path.join(root,'templates/footer.html'))continue;
      const before=fs.readFileSync(file,'utf8');
      if(!footerPattern.test(before)||!before.includes('</head>'))continue;
      let after=before.replace(footerPattern,()=>footer);
      if(/<link\b[^>]*data-shared-footer[^>]*>/.test(after))after=after.replace(/<link\b[^>]*data-shared-footer[^>]*>/,()=>link);
      else after=after.replace('</head>',()=> '  '+link+'\n</head>');
      if(after!==before){fs.writeFileSync(file,after);updated++;}
    }
  };
  visit(root);
  return updated;
}
