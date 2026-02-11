function getEscalaHoje() {
  // SIMULAÇÃO baseada no seu PDF
  return {
    periodo: "Semana atual",
    noturno: ["Diogo"],
    diurno: ["Salviano", "Rodolfo"],
    apoio: ["Emanuel", "Luiz", "Júnior"],
    horarios: {
      noturno: "19h às 05h",
      diurno: "07h às 17h",
    },
  };
}

module.exports = {
  getEscalaHoje,
};
