const normalize=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

// One vocabulary across sections; optional editorial choices take precedence.
export const topics=[
  {slug:'inteligencia-artificial',label:'Inteligencia artificial',weight:3,terms:['inteligencia artificial','ia','chatgpt','algoritmos','algoritmico','generativa']},
  {slug:'neurociencia',label:'Neurociencia',weight:3,terms:['neurociencia','neurotecnologia','neuroetica','cerebro','cerebral','sistema nervioso']},
  {slug:'filosofia',label:'Filosofía',weight:1,terms:['filosofia','filosofico','estoicismo','ortega y gasset']},
  {slug:'etica',label:'Ética',weight:1,terms:['etica','etico','bioetica','juicio moral']},
  {slug:'educacion',label:'Educación',weight:2,terms:['educacion','educativo','docencia','docente','ensenanza','aprendizaje','universidad','estudiantes']},
  {slug:'ciencia',label:'Ciencia',weight:1,terms:['ciencia','cientifico','ciencias']},
  {slug:'tecnologia',label:'Tecnología',weight:1,terms:['tecnologia','tecnologico','tecnociencia']},
  {slug:'salud',label:'Salud y medicina',weight:2,terms:['salud','medicina','medico','clinico','enfermedad','rehabilitacion']},
  {slug:'historia',label:'Historia',weight:2,terms:['historia','historico']},
  {slug:'cultura',label:'Cultura',weight:1,terms:['cultura','cultural','humanidades','arte']},
  {slug:'literatura',label:'Literatura',weight:2,terms:['literatura','literario','novela','poesia']},
  {slug:'teologia',label:'Teología y espiritualidad',weight:2,terms:['teologia','teologico','espiritualidad','fe','religion','religioso','postsecular']},
  {slug:'empresa',label:'Empresa y liderazgo',weight:2,terms:['empresa','empresarial','liderazgo','organizaciones','organizacional']},
  {slug:'cine',label:'Cine',weight:2,terms:['cine','cinematografico','pelicula','audiovisual']},
];
const known=new Set(topics.map(topic=>topic.slug));
export function identifyTopics(item,inherited=[]){
  if(item.topics!==undefined&&item.topics!==null&&item.topics!==''&&(!Array.isArray(item.topics)||item.topics.some(topic=>!known.has(topic))))throw Error(`${item.slug}: selecciona temas válidos para las recomendaciones`);
  if(item.topics?.length)return [...new Set(item.topics)];
  const text=' '+normalize([item.title,item.summary,...(item.categories||[]),...(item.collections||[])].filter(Boolean).join(' '))+' ';
  const inferred=topics.filter(topic=>topic.terms.some(term=>text.includes(' '+normalize(term)+' '))).map(topic=>topic.slug);
  return [...new Set([...inherited,...inferred])];
}
