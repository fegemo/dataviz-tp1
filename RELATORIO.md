# Relatório do TP1

Este relatório descreve as atividades realizadas para o desenvolvimento
de uma tabela com funcionalidades dinâmicas como busca, ordenação e paginação.
A tabela pode ser visualizada em https://fegemo.github.io/dataviz-tp1/ e seu código fonte está hospedado em https://github.com/fegemo/dataviz-tp1/.

Autores do trabalho:

1. Flávio Roberto dos Santos Coutinho (pós graduação)
1. Presleyson Lima (pós graduação)

## Implentação das Funcionalidades

Foram utilizadas as bibliotecas [D3.js][d3] para a criação da tabela,
estilos do _framework_ [Bootstrap][bootstrap] para o _layout_ da página e
aparência da tabela e alguns ícones [FontAwesome][fa].

Foram implementadas as funcionalidades de:

- **Busca**: No cabeçalho da página há um campo de busca que possibilita
  o usuário a escrever um texto usado para que a tabela mostre apenas as
  linhas que contenham registros que contenham esse texto. Detalhes:
  - A parte de informações sobre a tabela (parte de baixo da página) mostra
    **a quantidade de registros** que apareceram na busca
  - _Extra_: os **trechos das palavras** que fizeram com que uma linha
    aparecesse após o filtro são **ressaltados**
    ([detalhes](#realçando-resultados-da-busca))
- **Ordenação**: Clicando-se no ícone de ordenação no cabeçalho de cada coluna
  os dados são ordenados de forma crescente ou decrescente, alternando entre
  uma e outra. Detalhes:
  - A ordenação **obedece o tipo de dados** do campo de cada coluna: uma coluna
    numérica ordena as linhas numericamente, texto: textualmente, data:
    ~~datualmente~~ como data
    ([detalhes](#ordenando-de-acordo-com-tipo-de-dados))
- **Paginação**: os dados da tabela são particionados em páginas. Detalhes:
  - Existem **diversos botões**, além dos "&laquo;" e "&raquo;", para facilitar
    a navegação entre páginas ([detalhes](#botões-da-paginação))
    - Um botão com o número da página atual fica com cor de fundo destacada
  - _Extra_: o **número de linhas por página** é encontrado **dinamicamente**,
    com o objetivo de aproveitar ao máximo o espaço vertical disponível
    sem que seja necessário usar barras de rolagem
    ([detalhes](#heurística-de-linhas-por-página))
- **Cabeçalhos fixos**: o tamanho das colunas se mantém com o passar
  das páginas ([detalhes](#mantendo-a-largura-das-colunas))
- **Mini gráfico de barras**: as colunas numéricas (`numEmps` e `raisedAmount`) receberam mini gráficos de barras (deitadas) em cada célula representando o valor percentual daquela célula em relação ao valor máximo ([detalhes](#mini-gráficos-de-barras))
  - Ao passar o mouse em cima de uma célula numérica, uma _tooltip_ mostra o valor porcentual


## Decisões Tomadas

A tabela foi desenvolvida usando recursos da versão ES2015 da linguagem JavaScript (_e.g._, _arrow functions_, classes) e também de recursos nível 4 do CSS (_e.g._, variáveis, _nesting_, função de cores).

Há duas classes: `Table` e `TableColumn`. A primeira contém a maior parte do código responsável pelas funcionalidades dinâmicas da tabela, enquanto que a segundo é usada apenas como uma estrutura de dados para guardar metainformação sobre cada coluna.

### Ordenando de acordo com tipo de dados

Para que a ordenação por valores de cada coluna fosse realizada da forma esperada, foi necessário converter os dados das colunas para os tipos de dados primitivos adequados a cada coluna.

Isso foi modelado como uma transformação a ser aplicada aos dados de cada coluna. Por exemplo:

```js
// coluna 'company' não requer transformação, logo: transforms.noop (no operation)
new TableColumn('company', 'Company', 'text-column', transforms.noop, 
  [formats.asSearchable])

// coluna 'fundedDate' requer cast para Date, logo: transforms.toDate
new TableColumn('fundedDate', 'Funded When', 'date-column', transforms.toDate,
  [formats.asDate, formats.asSearchable])
```

Além da transformação dos dados, algumas colunas tiveram seus valores formatados de maneira diferente. A coluna pode aplicar mais de uma formatação - na verdade, um _array_ de funções formatadoras. Por exemplo:

```js
// coluna 'numEmps' exibida como número com 0 casas decimais, logo: formats.asNumber
new TableColumn('numEmps', 'Employees', 'numeric-column mini-bar-column', transforms.toNumber,
  [num => formats.asNumber(num, 0), formats.asSearchable], [processors.max])

// coluna 'raisedAmount' exibida como moeda, logo: formats.asCurrency
new TableColumn('raisedAmt', 'Amount Raised', 'numeric-column mini-bar-column',
  transforms.toNumber, 
  [(num, row) => formats.asCurrency(num, 1, row.raisedCurrency), formats.asSearchable],
  [processors.max])
```

Todas as colunas possuem uma função formatadora chamada `formats.asSearchable` e essa transformação as torna capazes de ressaltar os resultados da busca em cada célula da tabela (vide próxima seção).

### Realçando resultados da busca

Uma função formatadora chamada `formats.asSearchable` foi criada para realçar trechos de dados da tabela que foram resultados de busca.

Isso foi feito substituindo os termos da busca (_e.g._, a palavra `web`) pela sequência `<mark>web</mark>`. Portanto, uma busca por `web` em uma linha com uma célula `A webster`, resultaria no campo ser apresentado como `A <mark>web</mark>ster`. Além disso, foi criada uma regra CSS para estilizar os elementos `<mark></mark>` com fundo amarelo.


### Botões da paginação

A paginação é acessada por meio de botões (&laquo;, &raquo; e botões com números de páginas). Os botões foram feitos usando _data-joins_ do D3.js em que os dados representam deslocamentos negativos ou positivos a partir da página corrente. O _array_ de dados sendo usado, inicialmente, é o seguinte:

```js
let pagesData = [-1, -30, -2, -1, 0, 1, 2, 30, 1]
```

Nele, as primeira e última posições representam os botões &laquo; e &raquo; (-1 página e +1 página); no centro há o botão `0` que representa a página corrente e, partindo dele nos dois sentidos há botões de -1/+1 página, -2/+2 páginas e -30/+30 páginas. Exceto pelos botões &laquo; e &raquo;, todos os outros são removidos do _array_ de dados se eles representam páginas menores que 0 ou maiores que o número total de páginas.

### Heurística de linhas-por-página

Para encontrar um número de linhas da tabela em cada página, foi criada a função `table.determineRowsPerPage()` que (a) desenha a tabela por completo (tudo em 1 página apenas), (b) verifica as alturas de cada linha e faz uma média ponderada de cada altura pela quantidade de linhas com esse valor. Depois disso, (c) a função verifica quantas linhas (com essa altura média) cabem na altura disponível para a tabela na página (excluindo, por exemplo, o espaço reservado para o cabeçalho da página).

### Mantendo a largura das colunas

Para que as larguras das colunas sejam mantidas independente da "largura dos dados", foi criada a função `table.determineColumnWidths()` que (a) desenha a tabela por completo (tudo em 1 página apenas) usando o algoritmo de _layout_ automático de tabelas do CSS (_i.e._, `table-layout: auto`) para que ele encontre os melhores valores de largura para cada coluna; depois (b) a função fixa os valores de largura para cada coluna e, então, (c) altera o algoritmo de _layout_ para fixo (_i.e._, `table-layout: fixed`).

### Mini gráficos de barras

Para mostrar os gráficos, foi necessário processar cada coluna numérica para determinar o maior valor. Quando da apresentação da célula de dado numérica, é construído o elemento da barra com largura igual ao valor da célula dividido pelo maior valor encontrado previamente para aquela coluna.

[d3]: https://d3js.org/
[bootstrap]: http://getbootstrap.com/
[fa]: http://fontawesome.io/
