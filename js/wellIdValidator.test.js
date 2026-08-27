const {
  normalizeWellId,
  isValidWellId,
  getWellIdError,
  formatWellIdInput,
  countDigitsBefore,
  positionAfterNDigits
} = require('./wellIdValidator');

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

describe('getWellIdError distingue formato vs rango', () => {
  test('null (valido) para 03-0123', () => {
    expect(getWellIdError(normalizeWellId('03-0123'))).toBeNull();
  });

  const formatoInvalido = ['AA-0123', '03-ABC', '112', '3123', '123-4567', '03-45678', ''];
  test.each(formatoInvalido)('"%s" -> FORMAT', (input) => {
    expect(getWellIdError(normalizeWellId(input))).toBe('FORMAT');
  });

  const rangoInvalido = ['000012', '20-0123', '00-0001', '25-0001'];
  test.each(rangoInvalido)('"%s" -> RANGE', (input) => {
    expect(getWellIdError(normalizeWellId(input))).toBe('RANGE');
  });
});

describe('cursor logico al enmascarar (countDigitsBefore + positionAfterNDigits)', () => {
  test('cuenta solo digitos antes del cursor, ignorando el guion', () => {
    expect(countDigitsBefore('03-1234', 7)).toBe(6);
    expect(countDigitsBefore('03-1234', 3)).toBe(2); // cursor justo despues del guion
    expect(countDigitsBefore('03-1234', 0)).toBe(0);
  });

  test('ubica la posicion despues de N digitos en el string ya formateado', () => {
    expect(positionAfterNDigits('01-234', 1)).toBe(1); // despues del "0"
    expect(positionAfterNDigits('01-234', 2)).toBe(2); // despues del "1", antes del guion
    expect(positionAfterNDigits('01-234', 5)).toBe(6); // despues del ultimo digito
    expect(positionAfterNDigits('01-234', 0)).toBe(0);
  });

  test('backspace en el medio: borrar el "3" de "03-1234" deja el cursor tras el "0"', () => {
    // Simula lo que ya hizo el navegador: el usuario borro un caracter y
    // el input quedo en "0-1234" con el cursor en la posicion 1.
    const valorTrasBackspace = '0-1234';
    const cursorTrasBackspace = 1;
    const digitosAntes = countDigitsBefore(valorTrasBackspace, cursorTrasBackspace);
    const formateado = formatWellIdInput(valorTrasBackspace);
    expect(formateado).toBe('01-234');
    expect(positionAfterNDigits(formateado, digitosAntes)).toBe(1);
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
