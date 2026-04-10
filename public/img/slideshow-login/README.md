# Slideshow do Login

Coloque aqui as fotos reais da empresa para o hero animado da tela de login.

## Convenção de nome
Use o padrão abaixo (qualquer uma das extensões listadas):

- `slide-01.jpg` (ou `.jpeg`, `.png`, `.webp`)
- `slide-02.jpg`
- `slide-03.jpg`
- ... até `slide-30.*`

## Exemplo
`public/img/slideshow-login/slide-01.jpg`
`public/img/slideshow-login/slide-02.jpg`
`public/img/slideshow-login/slide-03.jpg`

## Observações
- Não precisa editar o `views/auth/login.ejs` para cada imagem nova.
- O front detecta automaticamente quais `slide-XX` existem na pasta.
- Se não houver imagens na pasta, o sistema cai no fundo padrão `/IMG/campo-do-bg-gado-login.svg.jpeg`.
