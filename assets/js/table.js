const SORT_ORDER_TYPES = {
  'true': 'ascending',
  'false': 'descending'
};

const PAGE_LENGTH = 10;

class Table {
  constructor({ container, searchInput, statistics, pagination,
    headerTemplate, columns }) {
    // seleciona o elemento container e o template do cabeçalho
    this.containerEl = d3.select(container);
    this.searchEl = d3.select(searchInput);
    this.statisticsEl = this.containerEl.select(statistics);
    this.paginationEl = this.containerEl.select(pagination);
    this.headerTemplate = d3.select(headerTemplate).html();

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
    this.allData = [];

    this.sortConfig = {
      column: null,
      order: null
    };
    this.pageConfig = {
      page: -1
    };

    this.searchEl.on('keyup', () => {
      // filtra dos dados
      this.filterData(d3.event.currentTarget.value);
      // mostra a primeira página
      this.paginateData(0);
      location.hash = '#1';
      // recarrega as linhas da tabela
      this.createBody();
    });
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
        // gera uma cópia de todos os dados, já transformados
        this.allData = this.data.slice(0);
        // mostra apenas a primeira página
        this.paginateData(0);
        // ...e cria a tabela
        this.createTable();
        // configura a seção de "estatísticas"
        this.configureStatistics();
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
      .insert('table', ':first-child')
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
            let previousSortColumn = this.sortConfig.column;
            let sortConfig = {
              column: datum.originalName,
              order: this.sortConfig.column === previousSortColumn ?
                (this.sortConfig.order === null ?
                  true :
                  !this.sortConfig.order)
                : true,
              thEl: thEl
            }

            // efetivamente ordena
            this.sortData(sortConfig);
            // monta a primeira página
            this.paginateData(0);
            location.hash = '#1';
            // recarrega as linhas da tabela
            this.createBody();
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
      .data(this.pageConfig.page === -1 ? this.data : this.paginatedData)
      .enter()
      .append('tr');

    // cria uma célula para cada coluna, em cada linha
    let cells = rows
      .selectAll('td')
      .data(row => {
        // retorna um "dado" para cada célula desta linha
        return this.columns.map(col => {
          return {
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

    // atualiza o texto sobre como está a ordenação na parte de estatísticas
    this.statisticsEl.select('.sort-stats')
      .html((_1, _2, nodes) =>
        nodes[0].dataset.template.replace(
          '{{column}}',
          this.columns.find(c => c.originalName === sortConfig.column).label
        )
      )
      .style('visibility', () => sortConfig.column === null ? 'hidden' : 'visible');

    this.sortConfig = sortConfig;
  }

  filterData(query) {
    query = query ? query.trim() : '';
    let emptyQuery = query === '';
    this.filterConfig = {
      query: query,
      in: this.allData.filter(
        datum => emptyQuery || d3.values(datum)
          .some(v => v.toString().indexOf(query) !== -1)
      )
    };

    // atualiza o texto sobre como está o filtro na parte de estatísticas
    this.statisticsEl.select('.filter-stats')
      .html((_1, _2, nodes) =>
        nodes[0].dataset.template
          .replace('{{query}}', query)
          .replace('{{qty}}', this.filterConfig.in.length))
       .classed('empty',emptyQuery);

    this.data = this.filterConfig.in;
  }

  paginateData(page) {
    let length = this.data.length;
    let totalPages = Math.ceil(length / PAGE_LENGTH);

    this.pageConfig = {
      page: page,
      first: PAGE_LENGTH * page,      // início da página atual
      last: Math.min(length,          // último registro
        PAGE_LENGTH * (page + 1))     // fim da página atual
    };

    this.paginatedData = this.data.slice(
      this.pageConfig.first, this.pageConfig.last);

    // atualiza os elementos para refletirem a nova configuração das páginas
    let pagesData = [-1, -30, -2, -1, 0, 1, 2, 30, 1]
      .map(p => this.pageConfig.page + p)
      .filter((p, i, arr) => p >= 0 && p < totalPages || i === 0 || i === arr.length - 1);
    let pageLinks = this.paginationEl.selectAll('li').data(pagesData);

    let t = d3.transition()
      .duration(750)
      .ease(d3.easeElasticOut);

    // exiting elements
    let exiting = pageLinks.exit();
    exiting
      .style('position', 'absolute')
      .transition(t)
        .ease(d3.easeLinear)
        .style('opacity', 0)
        .style('transform', 'scale(0.1)')
        .remove();

    // updating elements
    pageLinks
      .classed('active', d => d === this.pageConfig.page)
      .classed('disabled', d => d < 0 || d >= totalPages)
      .select('a')
        .attr('href', d => `#${d+1}`)
        .html((d, i) => {
          switch (i) {
            case 0: return '<span aria-hidden="true">&laquo;</span>';
            case pagesData.length - 1: return '<span aria-hidden="true">&raquo;</span>';
            default: return d+1;
          }
        });

    // entering elmeents
    let entering = pageLinks.enter();
    entering.append('li')
      .style('transform', 'scale(0.1)')
      .style('opacity', '0')
      .classed('active', d => d === this.pageConfig.page)
      .append('a')
        .attr('href', d => `#${d+1}`)
        .classed('page-link', true)
        .html((d, i) => {
          switch (i) {
            case 0: return '<span aria-hidden="true">&laquo;</span>';
            case pagesData.length - 1: return '<span aria-hidden="true">&raquo;</span>';
            default: return d+1;
          }
        })
        .on('click', (d, i) => {
          if (d < 0 || d > totalPages - 1) {
            d3.event.preventDefault();
            return;
          }
          // foi necessário fazer a nova paginação apenas no próximo tick
          // porque senão o navegador navegava para o hash fragment da nova
          // href do botão
          setTimeout(() => {
            // faz a paginação
            this.paginateData(d);
            // recria o corpo da tabela
            this.createBody();
          }, 0);
        })
    entering.selectAll('li:first-child, li:last-child')
      .classed('disabled', d => d < 0 || d >= totalPages)
      .select('a')
        .attr('aria-label', (_, i) => i === 0 ? 'Previous' : 'Next')
        .attr('rel', (_, i) => i === 0 ? 'prev' : 'next')
    entering.selectAll('li').transition(t)
      .style('transform', 'scale(1)')
      .style('transform', 'scale(1)')
      .style('opacity', '1');


    // atualiza o texto sobre como está o filtro na parte de estatísticas
    this.statisticsEl.select('.page-stats')
      .html((_1, _2, nodes) =>
        nodes[0].dataset.template
          .replace('{{page}}', this.pageConfig.page + 1)
          .replace('{{totalPages}}', totalPages)
          .replace('{{first}}', this.pageConfig.first + 1)
          .replace('{{last}}', this.pageConfig.last));
  }

  configureStatistics() {
    // evento do botão de "pin" da seção de estatísticas
    this.statisticsEl.select('.pin').on('click', (_d, i, nodes) => {
      let showing = this.statisticsEl.node().classList.toggle('showing');
      nodes[i].classList.toggle('active', showing);
    });
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
  searchInput: '#search-input',
  statistics: '.statistics',
  pagination: '.pagination',
  headerTemplate: '#sortable-th-template',
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
