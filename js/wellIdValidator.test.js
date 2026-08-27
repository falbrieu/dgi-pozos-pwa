const { normalizeWellId, isValidWellId, formatWellIdInput } = require('./wellIdValidator');

describe('normalizeWellId + isValidWellId: casos validos', () => {
  const casos = [
    ['03-0123', '03-0123'],
    ['3-123', '03-0123'],
    ['1-12', '01-0012'],
    ['03–0123', '03-0123'], // guion en dash unicode
    ['03 0123', '03-0123'],
    ['030123', '03-0123'], // 6 digitos sin separador, inequivoco
    ['19-9999', '19-9999'], // limite superior de departamento valido
    ['01-0000', '01-0000'], // limite inferior de departamento valido
  ];

  test.each(casos)('normaliza "%s" a "%s" y es valido', (input, esperado) => {
    const normalizado = normalizeWellId(input);
    expect(normalizado).toBe(esperado);
    expect(isValidWellId(normalizado)).toBe(true);
  });
});

describe('normalizeWellId + isValidWellId: casos invalidos', () => {
  const casos = [
    'AA-0123', // letras en departamento
    '03-ABC', // letras en pozo
    '112', // ambiguo: sin separador y no son 6 digitos
    '3123', // ambiguo: sin separador y no son 6 digitos
    '000012', // formato ok (6 digitos) pero departamento 00 fuera de rango
    '20-0123', // departamento 20, fuera de rango (maximo 19)
    '00-0001', // departamento 00, fuera de rango (minimo 01)
    '123-4567', // departamento de 3 digitos, no representable
    '03-45678', // pozo de 5 digitos, no representable
    '', // vacio
  ];

  test.each(casos)('"%s" no es un wellId valido', (input) => {
    const normalizado = normalizeWellId(input);
    expect(isValidWellId(normalizado)).toBe(false);
  });
});

describe('formatWellIdInput (enmascarado en vivo mientras se escribe)', () => {
  const casos = [
    ['0', '0'],
    ['03', '03'],
    ['031', '03-1'],
    ['0312', '03-12'],
    ['031234', '03-1234'],
    ['0312345', '03-1234'], // se corta en 6 digitos reales
    ['03-12', '03-12'], // ya viene con guion, se ignora y se reconstruye igual
    ['abc03def12', '03-12'], // letras se descartan, solo importan los digitos
  ];

  test.each(casos)('formatWellIdInput("%s") = "%s"', (input, esperado) => {
    expect(formatWellIdInput(input)).toBe(esperado);
  });
});
