import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Calculator, HelpCircle, RotateCcw } from 'lucide-react';
import { averageRemainderCandidates } from './averageRemainderCandidates';
import './styles.css';

const initialRows = [
  { id: 'whiteGreen', label: '白/绿', className: 'white-green', count: '', average: '', priceMultiplier: 200 },
  { id: 'blue', label: '蓝色', className: 'blue', count: '', average: '', priceMultiplier: 500 },
  { id: 'purple', label: '紫色', className: 'purple', count: '', average: '', priceMultiplier: 3000, maxCount: 20 },
  { id: 'gold', label: '金色', className: 'gold', count: '', average: '', priceMultiplier: 10000, maxCount: 12 },
  { id: 'red', label: '红色', className: 'red', count: '', average: '', priceMultiplier: 100000, maxCount: 5 },
];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  if (!value) return '0';
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value);
}

function getRowGrid(row) {
  return toNumber(row.count) * toNumber(row.average);
}

function getRowPrice(row) {
  if (row.id === 'red') return toNumber(row.count) * row.priceMultiplier;
  return getRowGrid(row) * row.priceMultiplier;
}

function getRowPriceWithCount(row, count) {
  if (row.id === 'red') return count * row.priceMultiplier;
  return count * toNumber(row.average) * row.priceMultiplier;
}

function getAverageRemainderKey(average) {
  const trimmedAverage = String(average).trim();
  if (!trimmedAverage) return '';
  if (!trimmedAverage.includes('.')) return 'integer';

  const decimalPart = trimmedAverage.split('.')[1];
  if (!decimalPart) return '';
  if (/^0+$/.test(decimalPart)) return 'integer';

  if (decimalPart.length === 1) return `0.${decimalPart}`;
  return `0.${decimalPart.slice(0, 2)}`;
}

function isAverageReadyForAutoFill(average) {
  const trimmedAverage = String(average).trim();
  if (!trimmedAverage) return false;
  if (!trimmedAverage.includes('.')) return true;

  const decimalPart = trimmedAverage.split('.')[1] ?? '';
  return decimalPart.length >= 2;
}

function hasKnownCount(row) {
  return String(row.count).trim() !== '';
}

function getRemainingCountLimit(row, allRows, totalItemsValue) {
  const total = toNumber(totalItemsValue);
  if (!total || allRows.length === 0) return null;

  const otherKnownCount = allRows.reduce((sum, otherRow) => {
    if (otherRow.id === row.id || !hasKnownCount(otherRow)) return sum;
    if (row.id !== 'red' && otherRow.id === 'red') return sum;
    return sum + toNumber(otherRow.count);
  }, 0);

  return Math.max(total - otherKnownCount, 0);
}

function getPossibleCounts(row, allRows = [], totalItemsValue = '') {
  const { average, maxCount } = row;
  const remainderKey = getAverageRemainderKey(average);
  const remainingLimit = getRemainingCountLimit(row, allRows, totalItemsValue);
  let candidates =
    remainderKey === 'integer'
      ? Array.from({ length: 30 }, (_, index) => index + 1)
      : averageRemainderCandidates[remainderKey] ?? [];

  if (maxCount) candidates = candidates.filter((count) => count <= maxCount);
  if (remainingLimit !== null) candidates = candidates.filter((count) => count <= remainingLimit);
  return candidates;
}

function applyAutoRedCount(currentRows, totalItemsValue) {
  const nonRedRows = currentRows.filter((row) => row.id !== 'red');
  const allNonRedCountsKnown = nonRedRows.every((row) => hasKnownCount(row));
  const knownCount = nonRedRows.reduce((sum, row) => sum + toNumber(row.count), 0);
  const redRow = currentRows.find((row) => row.id === 'red');
  const redMaxCount = redRow?.maxCount ?? Infinity;
  const nextRedCount = allNonRedCountsKnown
    ? String(Math.min(Math.max(toNumber(totalItemsValue) - knownCount, 0), redMaxCount))
    : '0';

  return currentRows.map((row) => (row.id === 'red' ? { ...row, count: nextRedCount } : row));
}

function applySingleCandidateCounts(currentRows, totalItemsValue) {
  let nextRows = currentRows;

  for (let index = 0; index < currentRows.length; index += 1) {
    let changed = false;

    nextRows = nextRows.map((row) => {
      if (row.id === 'red') return row;
      if (!isAverageReadyForAutoFill(row.average)) return row;
      const possibleCounts = getPossibleCounts(row, nextRows, totalItemsValue);
      if (possibleCounts.length !== 1 || row.count === String(possibleCounts[0])) return row;
      changed = true;
      return { ...row, count: String(possibleCounts[0]) };
    });

    if (!changed) break;
  }

  return nextRows;
}

function App() {
  const [totalItems, setTotalItems] = useState('');
  const [rows, setRows] = useState(initialRows);
  const [inference, setInference] = useState(null);
  const [isFaqOpen, setIsFaqOpen] = useState(false);

  const totals = useMemo(() => {
    const knownCount = rows
      .filter((row) => row.id !== 'red')
      .reduce((sum, row) => sum + toNumber(row.count), 0);
    const typedCount = rows.reduce((sum, row) => sum + toNumber(row.count), 0);
    const totalGrid = rows.reduce((sum, row) => sum + getRowGrid(row), 0);
    const totalPrice = rows.reduce((sum, row) => sum + getRowPrice(row), 0);

    return {
      knownCount,
      typedCount,
      totalGrid,
      totalPrice,
      redCount: rows.find((row) => row.id === 'red')?.count ?? '0',
      isOver: knownCount > toNumber(totalItems) && toNumber(totalItems) > 0,
    };
  }, [rows, totalItems]);

  const updateTotalItems = (value) => {
    setTotalItems(value);
    setRows((currentRows) => applyAutoRedCount(applySingleCandidateCounts(currentRows, value), value));
  };

  const updateRow = (id, field, value) => {
    setRows((currentRows) =>
      {
        const nextRows = currentRows.map((row) =>
          row.id === id ? { ...row, [field]: value } : row,
        );

        if (field === 'average') {
          const rowsWithSingleCandidates = applySingleCandidateCounts(nextRows, totalItems);
          if (id === 'red') return rowsWithSingleCandidates;
          return applyAutoRedCount(rowsWithSingleCandidates, totalItems);
        }

        if (id === 'red' || field !== 'count') return nextRows;
        return applyAutoRedCount(applySingleCandidateCounts(nextRows, totalItems), totalItems);
      },
    );
  };

  const reset = () => {
    setTotalItems('');
    setRows(initialRows);
    setInference(null);
  };

  const runInference = () => {
    const total = toNumber(totalItems);
    const nonRedRows = rows.filter((row) => row.id !== 'red');
    const knownRows = rows.filter((row) => row.id !== 'red' && hasKnownCount(row));
    const knownSum = knownRows.reduce((sum, row) => sum + toNumber(row.count), 0);
    const unknownRows = rows.filter((row) => {
      if (row.id === 'red') return true;
      return !hasKnownCount(row);
    });
    const remaining = Math.max(total - knownSum, 0);

    if (!total) {
      setInference({
        error: '请先填写总藏品数。',
        knownRows,
        knownSum,
        redRange: null,
        solutions: [],
      });
      return;
    }

    if (knownSum > total) {
      setInference({
        error: '已确定格数超过总藏品数，无法推算。',
        knownRows,
        knownSum,
        redRange: null,
        solutions: [],
      });
      return;
    }

    const candidateMap = new Map();
    const errors = [];

    unknownRows.forEach((row) => {
      if (row.id === 'red') {
        const redMax = row.maxCount ?? remaining;
        const redCandidates =
          nonRedRows.every((nonRedRow) => hasKnownCount(nonRedRow))
            ? [remaining].filter((count) => count <= redMax)
            : Array.from({ length: Math.min(remaining, redMax) + 1 }, (_, index) => index);

        candidateMap.set(
          row.id,
          redCandidates,
        );

        if (redCandidates.length === 0) {
          errors.push(`${row.label}超过上限 ${redMax}`);
        }
        return;
      }

      const candidates = getPossibleCounts(row, rows, totalItems);
      candidateMap.set(row.id, candidates);

      if (candidates.length === 0) {
        errors.push(`${row.label}没有可用的可能格数`);
      }
    });

    if (errors.length > 0) {
      setInference({
        error: errors.join('，'),
        knownRows,
        knownSum,
        redRange: null,
        solutions: [],
      });
      return;
    }

    const solutions = [];
    const allSolutions = [];
    const variables = unknownRows.map((row) => ({
      row,
      candidates: candidateMap.get(row.id) ?? [],
    }));

    const search = (index, picked, pickedSum) => {
      if (index === variables.length) {
        if (knownSum + pickedSum !== total) return;

        const counts = new Map(rows.map((row) => [row.id, toNumber(row.count)]));
        picked.forEach((count, id) => counts.set(id, count));

        const totalPrice = rows.reduce(
          (sum, row) => sum + getRowPriceWithCount(row, counts.get(row.id) ?? 0),
          0,
        );
        const solution = {
          counts,
          guessedIds: new Set(picked.keys()),
          totalPrice,
          redCount: counts.get('red') ?? 0,
        };

        allSolutions.push(solution);
        if (solutions.length < 6) solutions.push(solution);
        return;
      }

      const { row, candidates } = variables[index];
      candidates.forEach((count) => {
        const nextSum = pickedSum + count;
        if (knownSum + nextSum > total) return;

        const nextPicked = new Map(picked);
        nextPicked.set(row.id, count);
        search(index + 1, nextPicked, nextSum);
      });
    };

    search(0, new Map(), 0);

    const redCounts = allSolutions.map((solution) => solution.redCount);
    const redRange =
      redCounts.length > 0
        ? {
            min: Math.min(...redCounts),
            max: Math.max(...redCounts),
          }
        : null;

    setInference({
      error: allSolutions.length === 0 ? '没有找到满足总藏品数的组合。' : '',
      knownRows,
      knownSum,
      redRange,
      solutions,
      totalSolutionCount: allSolutions.length,
    });
  };

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <h1>竞拍之王计算器</h1>
        </div>
        <div className="top-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setIsFaqOpen((current) => !current)}
            aria-label="FAQ"
            title="FAQ"
          >
            <HelpCircle size={18} />
          </button>
          <button className="icon-button" type="button" onClick={reset} aria-label="清空" title="清空">
            <RotateCcw size={18} />
          </button>
        </div>
      </section>

      {isFaqOpen && (
        <section className="faq-wrap">
          <div className="faq-block">
            <h2>上限猜测</h2>
            <p>紫色最多 20 件，金色最多 12 件，红色最多 5 件。</p>
          </div>
          <div className="faq-block">
            <h2>小数推测</h2>
            <p>
              均格只用小数部分推测可能件数，例如 2.33 会查 0.33。整数均格会认为 1-30 件都有可能。
            </p>
          </div>
          <div className="faq-block">
            <h2>特殊格式</h2>
            <p>
              0.7 和 0.70 会按不同小数处理，所以均格输入框会保留原始文本格式。
            </p>
          </div>
        </section>
      )}

      <section className="summary-band">
        <label className="field total-field">
          <span>总藏品数</span>
          <input
            inputMode="numeric"
            min="0"
            type="number"
            value={totalItems}
            onChange={(event) => updateTotalItems(event.target.value)}
          />
        </label>

        <div className="stat">
          <span>已知数量</span>
          <strong className={totals.isOver ? 'danger-text' : ''}>{formatNumber(totals.knownCount)}</strong>
        </div>
        <div className="stat">
          <span>自动红色</span>
          <strong className={totals.isOver ? 'danger-text' : ''}>{formatNumber(toNumber(totals.redCount))}</strong>
        </div>
        <div className="stat highlight">
          <span>估算总格</span>
          <strong>{formatNumber(totals.totalGrid)}</strong>
        </div>
        <div className="stat price-stat">
          <span>估算总价</span>
          <strong>{formatNumber(totals.totalPrice)}</strong>
        </div>
      </section>

      {totals.isOver && (
        <p className="warning-text">已知四种品质数量超过总藏品数，红色数量已按 0 处理。</p>
      )}

      <section className="table-wrap">
        <div className="table-title">
          <Calculator size={18} />
          <span>颜色估算</span>
        </div>
        <div className="grid-table">
          <div className="grid-head">颜色</div>
          <div className="grid-head">确定件数</div>
          <div className="grid-head">可能件数</div>
          <div className="grid-head">均格</div>
          <div className="grid-head">总格</div>
          <div className="grid-head">总价</div>

          {rows.map((row) => {
            const rowGrid = getRowGrid(row);
            const rowPrice = getRowPrice(row);
            const possibleCounts = getPossibleCounts(row, rows, totalItems);

            return (
              <React.Fragment key={row.id}>
                <div className="color-cell">
                  <span className={`dot ${row.className}`} />
                  <span>{row.label}</span>
                </div>
                <input
                  className={row.id === 'red' ? 'table-input auto-count-input' : 'table-input'}
                  inputMode="numeric"
                  min="0"
                  type="number"
                  value={row.count}
                  onChange={(event) => updateRow(row.id, 'count', event.target.value)}
                  placeholder="0"
                />
                <output className="possible-counts">
                  {possibleCounts.length > 0 ? possibleCounts.join(', ') : '-'}
                </output>
                <input
                  className="table-input"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  type="text"
                  value={row.average}
                  onChange={(event) => updateRow(row.id, 'average', event.target.value)}
                  placeholder="0.00"
                />
                <output className="readonly-total">{formatNumber(rowGrid)}</output>
                <output className="readonly-total price-total">{formatNumber(rowPrice)}</output>
              </React.Fragment>
            );
          })}
        </div>
        <div className="grand-total">
          <span>所有颜色总价</span>
          <strong>{formatNumber(totals.totalPrice)}</strong>
        </div>
      </section>

      <section className="action-wrap">
        <button className="infer-button" type="button" onClick={runInference}>
          一键推算
        </button>
      </section>

      {inference && (
        <section className="inference-wrap">
          <div className="table-title">
            <Calculator size={18} />
            <span>推算结果</span>
          </div>

          {inference.error && <p className="warning-text inference-warning">{inference.error}</p>}

          <div className="inference-meta">
            <div className="stat">
              <span>红色可能范围</span>
              <strong>
                {inference.redRange
                  ? `${inference.redRange.min} - ${inference.redRange.max}`
                  : '-'}
              </strong>
            </div>
            <div className="stat">
              <span>已知件数</span>
              <strong>{formatNumber(inference.knownSum)}</strong>
            </div>
            <div className="known-list">
              <span>已知信息</span>
              <strong>
                {inference.knownRows.length > 0
                  ? inference.knownRows
                      .map((row) => `${row.label} ${formatNumber(toNumber(row.count))}`)
                      .join('，')
                  : '暂无'}
              </strong>
            </div>
          </div>

          {inference.solutions.length > 0 && (
            <div className="solution-list">
              <div className="solution-count">
                共找到 {formatNumber(inference.totalSolutionCount)} 种，显示前 6 种
              </div>
              {inference.solutions.map((solution, index) => (
                <article className="solution-card" key={`${index}-${solution.totalPrice}`}>
                  <div className="solution-card-head">
                    <span>可能性 {index + 1}</span>
                    <strong>{formatNumber(solution.totalPrice)}</strong>
                  </div>
                  <div className="solution-colors">
                    {rows.map((row) => (
                      <div className="solution-color" key={row.id}>
                        <span className={`dot ${row.className}`} />
                        <span>{row.label}</span>
                        <strong>{formatNumber(solution.counts.get(row.id) ?? 0)}</strong>
                        <em>{solution.guessedIds.has(row.id) ? '猜' : '已知'}</em>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
