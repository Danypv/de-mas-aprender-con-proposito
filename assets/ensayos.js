// The home form also works without JavaScript. Catalogue filtering enhances it.
for(const form of document.querySelectorAll('.ensayos-form')){
  const select=form.querySelector('select');
  const catalog=document.querySelector('[data-essay-catalog]');
  if(!catalog)continue;
  const cards=[...catalog.querySelectorAll('[data-essay-categories]')];
  const counter=document.querySelector('[data-essay-count]');
  const empty=document.querySelector('[data-essay-empty]');
  const apply=()=>{
    let count=0;
    for(const card of cards){const visible=!select.value||JSON.parse(card.dataset.essayCategories).includes(select.value);card.hidden=!visible;if(visible)count++}
    counter.textContent=`${count} ${count===1?'ensayo':'ensayos'}`;
    empty.hidden=count>0||cards.length===0;
    const url=new URL(location.href);if(select.value)url.searchParams.set('tema',select.value);else url.searchParams.delete('tema');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  };
  const requested=new URL(location.href).searchParams.get('tema');
  if([...select.options].some(option=>option.value===requested))select.value=requested;
  select.addEventListener('change',apply);
  form.addEventListener('submit',event=>{event.preventDefault();apply()});
  apply();
}
