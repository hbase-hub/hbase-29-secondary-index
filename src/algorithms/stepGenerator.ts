/**
 * 二级索引方案 — 步骤生成器
 *
 * 动画展示 HBase 二级索引实现：HBase 原生只支持 RowKey 索引，
 * 二级索引通过 Observer 协处理器在写主表时同步写索引表
 * （索引表 RowKey = 被索引列值，value = 主表 RowKey）。
 * 查询时先查索引表拿到主表 RowKey，再回主表 Get，避免全表扫描。
 */
import type { Step, VisualElement, VariableState } from '../types'

/** 二级索引方案伪代码 */
export const TEMPLATE_CODE = `// 二级索引：Observer 写主表时同步维护索引表
class IndexObserver extends BaseRegionObserver {

    // postPut：主表写入后，同步写索引表
    public void postPut(ObserverContext ctx, Put put, WALEdit edit) {
        byte[] val = put.getValue(CF, indexedCol);
        Put idxPut = new Put(val);                  // 索引表 RowKey = 被索引列值
        idxPut.addColumn(IDX_CF, "rowkey", put.getRow());
        idxTable.put(idxPut);
    }
}

// 查询：按二级列查，先查索引表拿 RowKey，再回主表
Get idxGet = new Get(Bytes.toBytes("alice@x.com"));
Result r = idxTable.get(idxGet);
byte[] mainRowKey = r.value();                      // user123
Result data = mainTable.get(new Get(mainRowKey));`

// 画布布局常量
const LAYOUT = {
  client: { x: 400, y: 30, w: 200, h: 70, label: 'Client' },
  maintable: { x: 60, y: 200, w: 200, h: 80, label: '主表 users' },
  observer: { x: 340, y: 200, w: 180, h: 80, label: 'IndexObserver' },
  idxtable: { x: 620, y: 200, w: 200, h: 80, label: '索引表 idx_email' },
  scan: { x: 400, y: 380, w: 200, h: 60, label: '对比全表扫描' },
}

function makeElements(highlight?: string): VisualElement[] {
  const mk = (
    key: keyof typeof LAYOUT,
    type: string,
    state: string
  ): VisualElement => {
    const l = LAYOUT[key]
    return {
      id: key,
      type,
      label: l.label,
      x: l.x,
      y: l.y,
      width: l.w,
      height: l.h,
      state: key === highlight ? 'active' : state,
    }
  }
  return [
    mk('client', 'client', 'idle'),
    mk('maintable', 'table', 'idle'),
    mk('observer', 'hook', 'idle'),
    mk('idxtable', 'table', 'idle'),
    mk('scan', 'compare', 'idle'),
  ]
}

const BASE_VARS: VariableState[] = [
  { name: 'indexedCol', value: 'email', line: 3, type: 'byte[]' },
  { name: 'idxRowKey', value: 'alice@x.com', line: 9, type: 'byte[]' },
  { name: 'mainRowKey', value: 'user123', line: 11, type: 'byte[]' },
]

export function generateSteps(): Step[] {
  const steps: Step[] = []
  let idx = 0

  const push = (
    desc: string,
    line: number,
    vars: VariableState[],
    elements: VisualElement[],
    arrows: { from: string; to: string; label?: string }[] = [],
    actionLabel?: string,
    statusText?: string
  ) => {
    steps.push({
      index: idx++,
      description: desc,
      currentLine: line,
      variables: vars,
      elements,
      connections: arrows.map((a, i) => ({
        id: `arrow-${i}`,
        fromId: a.from,
        toId: a.to,
        kind: 'arrow' as const,
        label: a.label,
      })),
      annotations: [],
      actionLabel,
      statusText: statusText ?? desc,
    })
  }

  // 步骤 0：二级索引总览
  push(
    'HBase 原生仅支持 RowKey 索引；二级索引由 Observer 同步维护索引表',
    3,
    [{ ...BASE_VARS[0] }],
    makeElements(),
    [
      { from: 'client', to: 'maintable', label: '写主表' },
      { from: 'maintable', to: 'observer', label: 'postPut' },
      { from: 'observer', to: 'idxtable', label: '同步写索引' },
    ],
    'OVERVIEW',
    '二级索引总览'
  )

  // 步骤 1：写主表
  push(
    'Client 写主表 Put(user123, email=alice@x.com)，触发 postPut',
    6,
    [{ name: 'mainRowKey', value: 'user123', line: 6, type: 'byte[]' }],
    makeElements('maintable'),
    [{ from: 'client', to: 'maintable', label: '1.写 user123' }],
    'PUT',
    '写主表'
  )

  // 步骤 2：Observer 读取被索引列
  push(
    'IndexObserver.postPut 读取被索引列 email 的值',
    7,
    [
      { name: 'indexedCol', value: 'email', line: 7, type: 'byte[]' },
      { name: 'val', value: 'alice@x.com', line: 7, type: 'byte[]' },
    ],
    makeElements('observer'),
    [{ from: 'maintable', to: 'observer', label: '2.postPut' }],
    'OBSERVE',
    'Observer 读被索引列'
  )

  // 步骤 3：构造索引表 Put
  push(
    '构造索引表 Put：RowKey=被索引列值(alice@x.com)，value=主表 RowKey(user123)',
    8,
    [
      { name: 'idxRowKey', value: 'alice@x.com', line: 9, type: 'byte[]' },
      { name: 'idxValue', value: 'user123', line: 9, type: 'byte[]' },
    ],
    makeElements('observer'),
    [],
    'BUILD_IDX',
    '构造索引 Put'
  )

  // 步骤 4：写入索引表
  push(
    'Observer 同步写入索引表 idx_email：RowKey=alice@x.com',
    10,
    [
      { name: 'idxTable', value: 'idx_email', line: 10, type: 'Table' },
      { name: 'idxRowKey', value: 'alice@x.com', line: 9, type: 'byte[]' },
    ],
    makeElements('idxtable'),
    [{ from: 'observer', to: 'idxtable', label: '3.写索引表' }],
    'INDEX_WRITE',
    '写入索引表'
  )

  // 步骤 5：按 email 查询索引表
  push(
    '查询按 email：先 Get 索引表 idx_email，RowKey=alice@x.com',
    14,
    [
      { name: 'idxGet', value: 'Get(alice@x.com)', line: 14, type: 'Get' },
      { name: 'idxRowKey', value: 'alice@x.com', line: 14, type: 'byte[]' },
    ],
    makeElements('idxtable'),
    [{ from: 'client', to: 'idxtable', label: '4.查索引表' }],
    'IDX_GET',
    '查询索引表'
  )

  // 步骤 6：拿到主表 RowKey 回主表
  push(
    '索引表返回 value=user123，作为主表 RowKey 回主表 Get',
    17,
    [
      { name: 'mainRowKey', value: 'user123', line: 17, type: 'byte[]' },
      { name: 'scanAvoided', value: 'true', line: 17, type: 'boolean' },
    ],
    makeElements('maintable'),
    [{ from: 'idxtable', to: 'maintable', label: '5.回主表 Get(user123)' }],
    'MAIN_GET',
    '回主表查询'
  )

  // 步骤 7：对比全表扫描
  push(
    '对比：无索引需 Scan 全表逐行过滤 email，效率极低；二级索引避免全表扫描',
    17,
    [
      { name: 'scanAvoided', value: 'true', line: 17, type: 'boolean' },
      { name: 'cost', value: '索引: O(1) vs Scan: O(N)', line: 17, type: 'String' },
    ],
    makeElements('scan'),
    [{ from: 'client', to: 'scan', label: '无索引: 全表 Scan' }],
    'COMPARE',
    '对比全表扫描'
  )

  // 步骤 8：完成
  push(
    '二级索引完成：按 email 查询经索引表直达 user123，避免全表扫描',
    18,
    [
      { name: 'indexedCol', value: 'email', line: 3, type: 'byte[]' },
      { name: 'mainRowKey', value: 'user123', line: 18, type: 'byte[]' },
      { name: 'scanAvoided', value: 'true', line: 18, type: 'boolean' },
    ],
    makeElements('maintable').map((e) => ({ ...e, state: 'done' })),
    [{ from: 'idxtable', to: 'maintable', label: '直达 user123' }],
    'DONE',
    '索引查询完成'
  )

  return steps
}
