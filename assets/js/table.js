const SORT_ORDER_TYPES = {
  'true': 'ascending',
  'false': 'descending'
};

class Table {
  constructor({ container, searchInput, headerTemplate, columns }) {
    // seleciona o elemento container e o template do cabeçalho
    this.containerEl = d3.select(container);
    this.headerTemplate = d3.select(headerTemplate).html();
    this.searchEl = d3.select(searchInput);

    // se o container ou o template ou o campo de busca não forem encontrados,
    // não tem como montar a tabela
    if (!this.containerEl) {
      throw new Error(`Elemento container ${container} não
        foi encontrado na página`);
    }
    if (!this.headerTemplate) {
      throw new Error(`Elemento com o template da célula de cabeçalho
        ${headerTemplate} não foi encontrado na página`);
    }

    this.columns = columns;
    this.data = [];
    this.sort = {
      column: null,
      order: null
    };
  }

  // carrega os dados da tabela a partir de um arquivo CSV
  // cujo caminho foi passado por parâmetro
  loadFromCSV(path) {
    d3.csv(path)
      .get(data => {
        // assim que conseguir os dados, atribui-os para o
        // membro data...
        this.data = data;
        // transforma os dados de acordo com a configuração das colunas
        this.data = this.transformData();
        // ...e cria a tabela
        this.createTable();
      });
  }

  transformData() {
    return this.data.map(row => {
       return this.columns.reduce((prev, curr) => {
         let value = row[curr.originalName];
         prev[curr.originalName] = curr.transform(value);
         return prev;
       }, {});
    });
  }

  // cria a tabela usando os dados em this.data
  createTable() {
    // cria o elemento principal <table> e coloca as classes
    // do bootstrap 'table' e 'table-striped'
    this.tableEl = this.containerEl
      .append('table')
      .classed('table table-striped', true);

    // cria os elementos <thead> e <tbody> devidamente
    // preenchidos com o cabeçalho e as linhas de dados, respec.
    this.theadEl = this.createHeader();
    this.tbodyEl = this.createBody();
  }

  // cria o elemento <thead> com a linha do cabeçalho
  createHeader() {
    return this.tableEl.append('thead')
      .append('tr')
      .selectAll('th')
      .data(this.columns)
      .enter()
      // coloca um <th> para cada coluna
      .append('th')
        // usa o template e o "recheia" com o nome da coluna
        .html(col => this.headerTemplate.replace('{{column}}', col.label))
        .attr('class', col => col.cl)
      // percorrre cada <th> inserido para colocar evento de clique de ordenação
      .each((datum, index, nodes) => {
        let thEl = nodes[index];
        d3.select(thEl)
          .selectAll('.column-sort')
          .on('click', () => {
            // define qual a nova ordenação (campo e ordem)
            let previousSortColumn = this.sort.column;
            let sortConfig = {
              column: datum.originalName,
              order: this.sort.column === previousSortColumn ?
                (this.sort.order === null ?
                  true :
                  !this.sort.order)
                : true,
              thEl: thEl
            }

            // efetivamente ordena
            this.sortData(sortConfig);
          });
      });
  }

  // cria o elemento <tbody> com uma linha para cada entrada de dados
  createBody() {
    this.tableEl.select('tbody').remove()
    let tbodyEl = this.tableEl.append('tbody');

    // cria uma linha para cada linha de dados
    let rows = tbodyEl
      .selectAll('tr')
      .data(this.data)
      .enter()
      .append('tr');

    // cria uma célula para cada coluna, em cada linha
    let cells = rows
      .selectAll('td')
      .data(row => {
        // retorna um "dado" para cada célula desta linha
        return this.columns.map(col => {
          return {
            // column: col.originalName,
            column: col,
            value: row[col.originalName],
            row: row
          };
        });
      })
      .enter()
      .append('td')
        .html(col => col.column.format(col.value, col.row))
        .attr('class', col => col.column.cl);

    return tbodyEl;
  }

  sortData(sortConfig) {
    // atualiza o ícone de sorting...
    // (a) da antiga coluna de ordenação
    d3.selectAll(sortConfig.thEl.closest('tr').querySelectorAll('th'))
      .classed(d3.values(SORT_ORDER_TYPES).join(' '), false);

    // (b) da atual coluna de ordenação
    d3.select(sortConfig.thEl)
      .classed(SORT_ORDER_TYPES[sortConfig.order], true)
      .classed(SORT_ORDER_TYPES[!sortConfig.order], false);

    // ordena os dados
    this.data.sort((rowA, rowB) => {
      let order = SORT_ORDER_TYPES[sortConfig.order];
      return d3[order](rowA[sortConfig.column], rowB[sortConfig.column]);
    });

    this.sort = sortConfig;

    this.createBody();
  }
}

class TableColumn {
  constructor(originalName, label,  cl, transform, format) {
    this.originalName = originalName;
    this.label = label;
    this.cl = cl || '';
    this.transform = transform || (s => s);
    this.format = format || (s => s);
  }
}

// class TableColumnNumber extends TableColumn {
//   constructor(originalName, label, cl, decimals) {
//     super(...arguments);
//     this.transformation =
//   }
// }

let formats = {
  asDate: date => d3.timeFormat('%m/%d/%Y')(date),
  asNumber: (num, decimals) => Number.isNaN(num) ? '' : d3.format(`.${decimals}f`)(num),
  asCurrency: (num, units, symbol) => `${symbol} ` + d3.format(',')(num/units),
  asCurrencyName: str => `<abbr title="${{'CAD': 'Canadian Dollar', 'EUR': 'Euro', 'USD': 'United States Dollar'}[str]}">${str}</abbr>`
};

let transforms = {
  toDate: str => new Date(str),
  toNumber: str => Number.isNaN(Number.parseFloat(str)) ? '' : Number.parseFloat(str),
  noop: x => x
};

let table = new Table({
  container: '#main-visualization',
  headerTemplate: '#sortable-th-template',
  searchInput: '#search-input',
  columns: [
    new TableColumn('permalink', 'Permalink', 'text-column'),
    new TableColumn('company', 'Company', 'text-column'),
    new TableColumn('numEmps', 'Employees', 'numeric-column', transforms.toNumber, num => formats.asNumber(num, 0)),
    new TableColumn('category', 'Category'),
    new TableColumn('city', 'City'),
    new TableColumn('state', 'State', 'short-text-column'),
    new TableColumn('fundedDate', 'Funded When', '', transforms.toDate, formats.asDate),
    new TableColumn('raisedAmt', 'Amount Raised', 'numeric-column', transforms.toNumber, (num, row) => formats.asCurrency(num, 1, row.raisedCurrency)),
    new TableColumn('raisedCurrency', 'Currency', 'short-text-column', transforms.noop, formats.asCurrencyName),
    new TableColumn('round', 'Round'),
  ]
});
table.loadFromCSV('data/dados-tp1.csv');
