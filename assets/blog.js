// Same normalized category keys as the home form. Original editorial labels
// remain in the content files; case/accent variants lead to the same results.
const key=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
const select=document.getElementById('tema');
if(select){
  const entries=[...document.querySelectorAll('.entrada')];
  const categories=item=>JSON.parse(item.dataset.categories||'[]');
  const labels=new Map();
  for(const item of entries)for(const label of categories(item))if(!labels.has(key(label)))labels.set(key(label),label);
  for(const [value,label]of [...labels].sort((a,b)=>a[1].localeCompare(b[1],'es',{sensitivity:'base'}))){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}
  const requested=key(new URL(location.href).searchParams.get('tema')||'');
  if(labels.has(requested))select.value=requested;
  const filter=()=>{
    let count=0;
    for(const item of entries){item.hidden=Boolean(select.value&&!categories(item).some(label=>key(label)===select.value));if(!item.hidden)count++}
    document.querySelector('.contador').textContent=`${count} ${count===1?'publicación':'publicaciones'}`;
    document.getElementById('sin-resultados').hidden=count!==0;
    const url=new URL(location.href);if(select.value)url.searchParams.set('tema',select.value);else url.searchParams.delete('tema');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  };
  select.addEventListener('change',filter);filter();
}
