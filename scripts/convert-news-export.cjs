// Usage: node scripts/convert-news-export.cjs <Firestore export JSON> <output SQL>
// Only the public news collection is imported. Existing article IDs stay intact.
const fs = require('node:fs');
function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue).toISOString();
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key,v])=>[key,decode(v)]));
  throw new Error('Unsupported Firestore value in news export');
}
function convert(exported) {
  return exported.documents.map(doc=>{
    if (!/\/documents\/news\/[^/]+$/.test(doc.name)) throw new Error('Export contains a non-news document');
    return { id: doc.name.split('/').at(-1), data: Object.fromEntries(Object.entries(doc.fields).map(([k,v])=>[k,decode(v)])) };
  });
}
if(require.main===module) {
  const rows=convert(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
  const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
  fs.writeFileSync(process.argv[3], '-- Preserved public news articles from Firebase. IDs preserve existing links.\n'+rows.map(row=>`insert into public.news(id,data) values(${literal(row.id)},${literal(JSON.stringify(row.data))}::jsonb) on conflict(parent_id,id) do nothing;`).join('\n')+'\n');
  console.log(`Prepared ${rows.length} news articles.`);
}
module.exports={convert};
