import { useState, useCallback, useMemo } from 'react';
import {
  Input, Button, Toast, Tag, Spin, Empty,
  Popconfirm, Typography, Table, Space, Banner,
} from '@douyinfe/semi-ui';
import {
  IconSearch, IconDelete, IconRefresh,
  IconStop, IconInfoCircle,
} from '@douyinfe/semi-icons';
import { SearchPorts, KillProcesses } from '../wailsjs/go/main/App';
import './App.scss';

const { Title, Text } = Typography;

function App() {
  const [port, setPort] = useState('');
  const [processes, setProcesses] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [killingPids, setKillingPids] = useState(new Set());
  const [searchedPorts, setSearchedPorts] = useState([]);

  // Unique PIDs from selection
  const selectedPids = useMemo(() => {
    const pids = new Set();
    selectedRowKeys.forEach(key => {
      const proc = processes.find((_, i) => `${processes[i].pid}-${i}` === key);
      if (proc) pids.add(proc.pid);
    });
    // Fallback: extract pid from key
    selectedRowKeys.forEach(key => {
      const pid = key.split('-')[0];
      if (pid) pids.add(pid);
    });
    return [...pids];
  }, [selectedRowKeys, processes]);

  // Parse port input: supports "8080", "8080 3000", "8080,3000,5432"
  const parsePorts = useCallback((input) => {
    return input
      .replace(/[,;，；\s]+/g, ' ')
      .trim()
      .split(' ')
      .filter(p => p && /^\d+$/.test(p));
  }, []);

  // Search
  const handleSearch = useCallback(async () => {
    const trimmed = port.trim();
    if (!trimmed) {
      Toast.warning({ content: '请输入端口号', duration: 2 });
      return;
    }

    const ports = parsePorts(trimmed);
    if (ports.length === 0) {
      Toast.warning({ content: '请输入有效的端口号（纯数字）', duration: 2 });
      return;
    }

    setLoading(true);
    setSearched(true);
    setSelectedRowKeys([]);
    setSearchedPorts(ports);

    try {
      const result = await SearchPorts(trimmed);
      setProcesses(result || []);
      if (!result || result.length === 0) {
        Toast.info({ content: `端口 ${ports.join(', ')} 无进程占用`, duration: 2 });
      }
    } catch (err) {
      Toast.error({ content: `查询失败: ${err}`, duration: 3 });
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, [port, parsePorts]);

  // Kill selected
  const handleKillSelected = useCallback(async () => {
    if (selectedPids.length === 0) return;

    setKillingPids(new Set(selectedPids));
    try {
      const results = await KillProcesses(selectedPids);
      const success = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (success.length > 0) {
        Toast.success({ content: `成功终止 ${success.length} 个进程`, duration: 2 });
      }
      if (failed.length > 0) {
        Toast.error({
          content: `${failed.length} 个进程终止失败`,
          duration: 3,
        });
      }

      setSelectedRowKeys([]);
      await handleSearch();
    } catch (err) {
      Toast.error({ content: `操作失败: ${err}`, duration: 3 });
    } finally {
      setKillingPids(new Set());
    }
  }, [selectedPids, handleSearch]);

  // Kill single
  const handleKillSingle = useCallback(async (pid) => {
    setKillingPids(prev => new Set([...prev, pid]));
    try {
      const results = await KillProcesses([pid]);
      if (results[0]?.success) {
        Toast.success({ content: `进程 ${pid} 已终止`, duration: 2 });
      } else {
        Toast.error({ content: results[0]?.message || '终止失败', duration: 3 });
      }
      setSelectedRowKeys(prev => prev.filter(k => !k.startsWith(pid + '-')));
      await handleSearch();
    } catch (err) {
      Toast.error({ content: `操作失败: ${err}`, duration: 3 });
    } finally {
      setKillingPids(prev => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
    }
  }, [handleSearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  // State tag color
  const stateTagColor = (state) => {
    if (!state) return 'grey';
    switch (state) {
      case 'LISTEN': return 'blue';
      case 'ESTABLISHED': return 'green';
      case 'CLOSE_WAIT': return 'red';
      case 'TIME_WAIT': return 'orange';
      default: return 'grey';
    }
  };

  // Table columns
  const columns = useMemo(() => [
    {
      title: '进程名',
      dataIndex: 'command',
      width: 140,
      ellipsis: { showTitle: true },
      render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'PID',
      dataIndex: 'pid',
      width: 90,
      render: (text) => (
        <Tag size="small" shape="circle" color="light-blue" style={{ fontFamily: 'monospace' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '用户',
      dataIndex: 'user',
      width: 100,
      ellipsis: { showTitle: true },
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      width: 80,
      render: (text) => (
        <Tag size="small" color={text === 'TCP' ? 'green' : 'orange'}>
          {text}
        </Tag>
      ),
    },
    {
      title: '端口',
      dataIndex: 'port',
      width: 80,
      render: (text) => (
        <Tag size="small" color="violet" style={{ fontFamily: 'monospace' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'state',
      width: 110,
      render: (text) => (
        <Tag size="small" color={stateTagColor(text)}>
          {text || '-'}
        </Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (text) => <Text type="tertiary" size="small">{text}</Text>,
    },
    {
      title: '连接信息',
      dataIndex: 'name',
      ellipsis: { showTitle: true },
      render: (text) => (
        <Text type="tertiary" size="small" style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {text}
        </Text>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        const isKilling = killingPids.has(record.pid);
        return (
          <Popconfirm
            title="确认终止"
            content={`确定终止进程 ${record.pid}（${record.command}）？`}
            onConfirm={() => handleKillSingle(record.pid)}
            position="left"
            okText="终止"
            cancelText="取消"
            okType="danger"
          >
            <Button
              icon={<IconStop />}
              size="small"
              type="danger"
              theme="light"
              loading={isKilling}
            >
              终止
            </Button>
          </Popconfirm>
        );
      },
    },
  ], [killingPids, handleKillSingle]);

  // Row selection
  const rowSelection = useMemo(() => ({
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({
      disabled: killingPids.has(record.pid),
    }),
  }), [selectedRowKeys, killingPids]);

  // Data with rowKey
  const dataSource = useMemo(
    () => processes.map((p, i) => ({ ...p, _key: `${p.pid}-${i}` })),
    [processes]
  );

  return (
    <div className="app">
      {/* Titlebar */}
      <div className="titlebar" style={{ '--wails-draggable': 'drag' }}>
        <div className="titlebar-content">
          <div className="titlebar-logo">
            <IconStop style={{ fontSize: 18, color: 'var(--semi-color-danger)' }} />
            <Title heading={6} style={{ margin: 0 }}>Kill Port</Title>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-bar">
          <Input
            prefix={<IconSearch />}
            placeholder="输入端口号，多个用空格或逗号分隔，如 8080 3000,5432"
            value={port}
            onChange={setPort}
            onKeyDown={handleKeyDown}
            size="large"
            className="search-input"
            showClear
          />
          <Button
            theme="solid"
            type="primary"
            size="large"
            onClick={handleSearch}
            loading={loading}
            icon={<IconSearch />}
            className="search-btn"
          >
            查询
          </Button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="result-section">
          {/* Toolbar */}
          {processes.length > 0 && (
            <div className="toolbar">
              <div className="toolbar-left">
                <Space align="center" spacing={4}>
                  {searchedPorts.map(p => (
                    <Tag key={p} size="small" color="blue" style={{ fontFamily: 'monospace' }}>{p}</Tag>
                  ))}
                </Space>
                <Text type="tertiary" style={{ marginLeft: 8 }}>
                  共 <Text strong type="primary">{processes.length}</Text> 条记录
                  {selectedRowKeys.length > 0 && (
                    <Text>，已选 <Text strong type="warning">{selectedRowKeys.length}</Text> 条</Text>
                  )}
                </Text>
              </div>
              <Space>
                <Button
                  icon={<IconRefresh />}
                  theme="light"
                  size="small"
                  onClick={handleSearch}
                  loading={loading}
                >
                  刷新
                </Button>
                <Popconfirm
                  title="批量终止"
                  content={`确定终止选中的 ${selectedPids.length} 个进程？此操作不可撤回。`}
                  onConfirm={handleKillSelected}
                  position="bottomRight"
                  okText="全部终止"
                  cancelText="取消"
                  okType="danger"
                >
                  <Button
                    icon={<IconDelete />}
                    type="danger"
                    theme="solid"
                    size="small"
                    disabled={selectedRowKeys.length === 0}
                  >
                    批量终止 ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="center-content">
              <Spin size="large" tip="正在查询..." />
            </div>
          ) : processes.length === 0 ? (
            <div className="center-content">
              <Empty
                image={<IconInfoCircle style={{ fontSize: 48, color: 'var(--semi-color-text-2)' }} />}
                title="未找到进程"
                description={`端口 ${searchedPorts.join(', ')} 当前没有进程占用`}
              />
            </div>
          ) : (
            <div className="table-section">
              <Table
                columns={columns}
                dataSource={dataSource}
                rowKey="_key"
                rowSelection={rowSelection}
                pagination={false}
                size="small"
                bordered
                sticky
                empty={<Empty description="暂无数据" />}
                className="process-table"
              />
            </div>
          )}
        </div>
      )}

      {/* Welcome */}
      {!searched && (
        <div className="welcome">
          <div className="welcome-card">
            <div className="welcome-icon-wrapper">
              <IconSearch style={{ fontSize: 40, color: 'var(--semi-color-primary)' }} />
            </div>
            <Title heading={4} style={{ margin: '16px 0 8px' }}>
              端口进程查询
            </Title>
            <Text type="tertiary" style={{ marginBottom: 24 }}>
              输入端口号查看占用进程并一键终止，支持多个端口同时查询
            </Text>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
