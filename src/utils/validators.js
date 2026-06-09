function validateCard(card) {
  if (!card) return false;
  if (!card.number || !card.expiry || !card.cvv) return false;
  return card.number.length >= 13 && card.number.length <= 19;
}

module.exports = { validateCard };
