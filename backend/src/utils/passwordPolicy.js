// Exige minimo 8 caracteres, mayuscula, minuscula, numero y caracter especial.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

module.exports = { PASSWORD_REGEX };
