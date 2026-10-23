
import React from 'react';
// Renders AI JSON as labelled sections; preserves false, 0, and empty values.
export default function AiResultSections({ result }) {
  if (result === null || result === undefined) return <section><h4>Result</h4><p>(none)</p></section>;
  const render = (v) => {
    if (v === false) return 'false'; if (v === 0) return '0'; if (v === '') return '(empty)';
    if (v === null || v === undefined) return '(none)'; if (Array.isArray(v)) return v.length ? null : '(empty list)';
    return null;
  };
  const walk = (value, label) => {
    const leaf = render(value);
    if (leaf !== null) return <div key={label}><strong>{label}:</strong> {leaf}</div>;
    if (Array.isArray(value)) return <div key={label}><strong>{label}:</strong><ul>{value.map((item,i)=><li key={i}>{typeof item==='object'?JSON.stringify(item):String(item)}</li>)}</ul></div>;
    if (typeof value === 'object') return <fieldset key={label}><legend>{label}</legend>{Object.entries(value).map(([k,v])=>walk(v,k))}</fieldset>;
    return <div key={label}><strong>{label}:</strong> {String(value)}</div>;
  };
  return <div>{typeof result==='object'&&!Array.isArray(result)?Object.entries(result).map(([k,v])=>walk(v,k)):walk(result,'Result')}</div>;
}
