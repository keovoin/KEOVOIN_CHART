/* VIS · Sample datasets + DNA templates */
(function () {
  window.VIS = window.VIS || {};

  var SAMPLES = {
    executive: {
      title: 'Executive Performance Review',
      icon: 'briefcase',
      color: '#1e3a8a',
      desc: 'Company-wide KPIs, revenue trend, and department performance.',
      tags: ['KPI Hero', 'Trend', 'Insights'],
      data:
'Month,Revenue,Expenses,Net Profit,Customers,NPS\n' +
'Jan,1240000,860000,380000,4200,42\n' +
'Feb,1310000,880000,430000,4480,45\n' +
'Mar,1180000,910000,270000,4610,44\n' +
'Apr,1520000,940000,580000,4980,51\n' +
'May,1670000,960000,710000,5320,54\n' +
'Jun,1810000,1010000,800000,5760,58\n' +
'Jul,1740000,1040000,700000,6010,57\n' +
'Aug,1980000,1080000,900000,6440,61\n' +
'Sep,2150000,1120000,1030000,6890,63'
    },

    finance: {
      title: 'Financial Summary',
      icon: 'money',
      color: '#0f766e',
      desc: 'Revenue vs budget, cost breakdown and cash-flow forecast.',
      tags: ['Waterfall', 'Variance', 'Forecast'],
      data:
'Quarter,Actual Revenue,Budget Revenue,Operating Cost,Gross Margin %\n' +
'Q1,4730000,4500000,2650000,44\n' +
'Q2,5000000,4800000,2910000,42\n' +
'Q3,5870000,5200000,3320000,43\n' +
'Q4,6410000,5900000,3480000,46'
    },

    sales: {
      title: 'Regional Sales Breakdown',
      icon: 'chart',
      color: '#635bff',
      desc: 'Sales by region with deal counts and win rate.',
      tags: ['Ranking', 'Bar', 'Donut'],
      data:
'Region,Sales,Deals,Win Rate %\n' +
'North America,3820000,142,38\n' +
'Europe,2910000,118,34\n' +
'Asia Pacific,2470000,96,41\n' +
'Latin America,980000,54,29\n' +
'Middle East,760000,38,32\n' +
'Africa,420000,21,27'
    },

    hr: {
      title: 'Workforce Overview',
      icon: 'users',
      color: '#7c3aed',
      desc: 'Headcount, hiring, attrition and department distribution.',
      tags: ['Headcount', 'Attrition', 'Diversity'],
      data:
'Department,Headcount,New Hires,Attrition %,Avg Tenure (yrs)\n' +
'Engineering,142,18,7.2,3.4\n' +
'Sales,86,12,11.5,2.1\n' +
'Marketing,44,6,9.1,2.8\n' +
'Operations,63,4,5.4,4.6\n' +
'Customer Success,58,9,8.7,2.3\n' +
'Finance,29,2,4.1,5.2\n' +
'People,21,3,6.0,3.9'
    },

    pmo: {
      title: 'Portfolio Health',
      icon: 'target',
      color: '#b45309',
      desc: 'Project status, budget consumption and completion.',
      tags: ['Status', 'Progress', 'Risk'],
      data:
'Project,Completion %,Budget Used %,Risk Score,Team Size\n' +
'Atlas Migration,82,74,3,12\n' +
'Orion Launch,45,58,6,8\n' +
'Helios Rebuild,96,91,2,15\n' +
'Nova Analytics,28,33,7,6\n' +
'Titan Compliance,63,60,4,9\n' +
'Vega Mobile,71,80,5,7'
    },

    funnel: {
      title: 'Conversion Funnel',
      icon: 'target',
      color: '#7928ca',
      desc: 'Stage-by-stage drop-off from visitor to customer.',
      tags: ['Funnel', 'Conversion'],
      data:
'Stage,Users\n' +
'Visitors,12000\n' +
'Sign-ups,4200\n' +
'Qualified,1800\n' +
'Trials,760\n' +
'Customers,320'
    },

    flow: {
      title: 'Traffic Flow',
      icon: 'layout',
      color: '#0e7490',
      desc: 'How users move from source to destination (Sankey).',
      tags: ['Sankey', 'Flow'],
      data:
'Source,Target,Users\n' +
'Search,Homepage,4200\n' +
'Social,Homepage,2100\n' +
'Email,Homepage,1200\n' +
'Homepage,Pricing,3800\n' +
'Homepage,Blog,1900\n' +
'Pricing,Signup,1600\n' +
'Blog,Signup,700'
    },

    roadmap: {
      title: 'Delivery Roadmap',
      icon: 'calendar',
      color: '#b45309',
      desc: 'Project phases on a timeline (Gantt).',
      tags: ['Gantt', 'Timeline'],
      data:
'Task,Start,End\n' +
'Discovery,0,2\n' +
'Design,2,5\n' +
'Build,4,10\n' +
'QA,9,12\n' +
'Launch,12,13'
    }
  };

  // DNA templates shown on Home + Templates pages (map to samples).
  var TEMPLATES = [
    { key: 'executive', name: 'Executive DNA', icon: 'briefcase', color: '#1e3a8a',
      desc: 'Large KPI hero, AI summary, trend, risk and recommendations.',
      tags: ['KPI Hero', 'Summary', 'Trend', 'Risk'] },
    { key: 'finance', name: 'Finance DNA', icon: 'money', color: '#0f766e',
      desc: 'Revenue KPIs, variance vs budget, cost split and forecast.',
      tags: ['Revenue', 'Variance', 'Forecast'] },
    { key: 'sales', name: 'Sales DNA', icon: 'chart', color: '#635bff',
      desc: 'Regional ranking, win-rate comparison and pipeline mix.',
      tags: ['Ranking', 'Comparison', 'Mix'] },
    { key: 'pmo', name: 'PMO DNA', icon: 'target', color: '#b45309',
      desc: 'Project health, milestone progress and RAID risk summary.',
      tags: ['Health', 'Progress', 'Risk'] },
    { key: 'hr', name: 'HR DNA', icon: 'users', color: '#7c3aed',
      desc: 'Headcount, hiring funnel, attrition and workforce insights.',
      tags: ['Headcount', 'Attrition', 'Diversity'] }
  ];

  window.VIS.samples = SAMPLES;
  window.VIS.templates = TEMPLATES;
})();
