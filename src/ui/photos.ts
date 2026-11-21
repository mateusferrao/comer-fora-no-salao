/** Fotos de banco livre (D107), hospedadas em public/fotos; créditos em public/fotos/CREDITOS.md. */
export const CATEGORY_PHOTOS: Record<string, string | undefined> = {
  entrada: "/fotos/entrada.jpg",
  prato: "/fotos/prato.jpg",
  porcao: "/fotos/porcao.jpg",
  sobremesa: "/fotos/sobremesa.jpg",
};

export const PHOTO_CREDITS = [
  { file: "salao.jpg", author: "Nenad Stojković", license: "CC BY 2.0" },
  { file: "entrada.jpg", author: "Karen and Brad Emerson", license: "CC BY 2.0" },
  { file: "prato.jpg", author: "Popo le Chien", license: "CC0" },
  { file: "porcao.jpg", author: "Andy Li", license: "CC0" },
  { file: "sobremesa.jpg", author: "Anna.Massini", license: "CC BY 4.0" },
] as const;
