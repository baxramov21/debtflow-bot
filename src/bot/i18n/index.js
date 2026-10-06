import uz from './uz';
import ru from './ru';

const dict = { uz, ru };

export function t(lang, path, params = {}) {
  const language = dict[lang] || dict['uz'];
  
  const keys = path.split('.');
  let value = language;
  
  for (const key of keys) {
    if (value === undefined) break;
    value = value[key];
  }
  
  if (typeof value !== 'string') {
    // Fallback to uzbek if string is missing in selected language
    if (lang !== 'uz') return t('uz', path, params);
    return path;
  }
  
  // Replace params
  return value.replace(/{(\w+)}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}
