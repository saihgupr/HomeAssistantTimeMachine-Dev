import { useState, useEffect, useMemo } from 'react';
import LovelaceDiffViewer from './LovelaceDiffViewer';
import ConfigMenu from './ConfigMenu';

interface BackupInfo {
  path: string;
  createdAt: number;
}

interface LovelaceFile {
  name: string;
}

interface BackupBrowserProps {
  backupRootPath: string;
  liveConfigPath: string;
  onSaveConfig: (config: { haUrl: string; haToken: string; backupFolderPath: string; liveFolderPath: string }) => void;
  reloadHomeAssistant: () => void;
}

interface HaConfig {
  haUrl: string;
  haToken: string;
}

export default function LovelaceBackupBrowser({ backupRootPath, liveConfigPath, onSaveConfig, reloadHomeAssistant }: BackupBrowserProps) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [liveConfigPathError, setLiveConfigPathError] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | null>(null);

  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [items, setItems] = useState<LovelaceFile[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [sortOrder, setSortOrder] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');

  const [isConfigMenuOpen, setConfigMenuOpen] = useState(false);
  const [haConfig, setHaConfig] = useState<HaConfig | null>(null);
  const [initialCronExpression, setInitialCronExpression] = useState('');

  const [selectedItem, setSelectedItem] = useState<LovelaceFile | null>(null);
  const [backupFileContent, setBackupFileContent] = useState('');
  const [liveFileContent, setLiveFileContent] = useState<string | null>('');

  useEffect(() => {
    const savedConfig = localStorage.getItem('haConfig');
    if (savedConfig) {
      setHaConfig(JSON.parse(savedConfig));
    }

    // Fetch existing schedule
    fetch('/api/schedule-backup')
      .then(res => res.json())
      .then(data => {
        if (data.jobs && data.jobs['default-backup-job']) {
          setInitialCronExpression(data.jobs['default-backup-job'].cronExpression);
        }
      })
      .catch(error => console.error('Failed to fetch schedule:', error));
  }, []);

  useEffect(() => {
    const validateLivePath = async () => {
      if (!liveConfigPath) {
        setLiveConfigPathError('Live Home Assistant Config Path cannot be empty.');
        return;
      }

      try {
        const response = await fetch('/api/validate-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: liveConfigPath }),
        });
        const data = await response.json();
        if (!data.isValid) {
          setLiveConfigPathError(data.error);
        } else {
          setLiveConfigPathError(null);
        }
      } catch (err) {
        setLiveConfigPathError('Error validating path.');
      }
    };

    validateLivePath();
  }, [liveConfigPath]);

  const sortedAndFilteredItems = useMemo(() => {
    const filtered = items.filter(item => 
      (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sorted = [...filtered];
    if (sortOrder === 'alpha-asc') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortOrder === 'alpha-desc') {
      sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    }
    return sorted;
  }, [items, sortOrder, searchTerm]);

  useEffect(() => {
    const fetchBackups = async () => {
      setIsLoadingBackups(true);
      setBackupError(null);
      try {
        const response = await fetch('/api/scan-backups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backupRootPath }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch backups');
        }
        const data = await response.json();
        setBackups(data.backups || []);
      } catch (err: unknown) {
        const error = err as Error;
        setBackupError(error.message);
      } finally {
        setIsLoadingBackups(false);
      }
    };

    if (backupRootPath) {
      fetchBackups();
    }

    setSelectedBackup(null);
    setItems([]);
  }, [backupRootPath]);

  const handleSelectBackup = async (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setIsLoadingItems(true);
    setItems([]);
    setError(null);
    try {
      const response = await fetch('/api/get-backup-lovelace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath: backup.path }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to load lovelace files`);
      }
      const data = await response.json();
      const files = data.lovelaceFiles.map((file: string) => ({ name: file }));
      setItems(files || []);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSelectItem = async (item: LovelaceFile) => {
    setSelectedItem(item);
    try {
      const backupResponse = await fetch('/api/get-backup-lovelace-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath: selectedBackup?.path, fileName: item.name }),
      });
      const backupData = await backupResponse.json();
      setBackupFileContent(backupData.content);

      const liveResponse = await fetch('/api/get-live-lovelace-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveConfigPath, fileName: item.name }),
      });
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        setLiveFileContent(liveData.content);
      } else {
        setLiveFileContent(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveFromMenu = (config: { haUrl: string; haToken: string; backupFolderPath: string; liveFolderPath: string }) => {
    setHaConfig({ haUrl: config.haUrl, haToken: config.haToken });
    localStorage.setItem('haConfig', JSON.stringify({ haUrl: config.haUrl, haToken: config.haToken }));
    onSaveConfig(config);
  };

  const handleRestore = async (fileName: string, content: string) => {
    try {
      const response = await fetch('/api/restore-lovelace-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveConfigPath, fileName, content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to restore ${fileName}`);
      }

      setSelectedItem(null);
      reloadHomeAssistant();
    } catch (err: unknown) {
      const error = err as Error;
      setNotificationMessage(`Error: ${error.message}`);
      setNotificationType('error');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
    const formattedTime = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
    return `${formattedDate} at ${formattedTime}`;
  };

  useEffect(() => {
    if (notificationMessage) {
      const timer = setTimeout(() => {
        setNotificationMessage(null);
        setNotificationType(null);
      }, 5000); // Clear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [notificationMessage]);

  return (
    <>
      {notificationMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 24px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: 1000,
            backgroundColor: notificationType === 'success' ? '#4CAF50' : '#ef4444',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {notificationMessage}
          <button onClick={() => setNotificationMessage(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}>
            &times;
          </button>
        </div>
      )}

      {isConfigMenuOpen && (
        <ConfigMenu
          onClose={() => setConfigMenuOpen(false)}
          onSave={handleSaveFromMenu}
          initialBackupFolderPath={backupRootPath}
          initialLiveFolderPath={liveConfigPath}
          liveConfigPathError={liveConfigPathError}
          initialCronExpression={initialCronExpression}
        />
      )}

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', height: 'calc(100vh - 220px)' }}>
        {/* Backups List */}
        <div style={{ backgroundColor: '#2d2d2d', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>Backups</h2>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>{backups.length} snapshots available</p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {isLoadingBackups && <p style={{ textAlign: 'center', color: '#9ca3af' }}>Scanning...</p>}
            {backupError && !isLoadingBackups && <p style={{ textAlign: 'center', color: '#ef4444' }}>{backupError}</p>}
            {!isLoadingBackups && backups.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {backups.map((backup) => (
                  <button
                    key={backup.path} // Use backup name as key
                    onClick={() => handleSelectBackup(backup)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: selectedBackup?.path === backup.path ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                      color: selectedBackup?.path === backup.path ? 'white' : '#d1d5db',
                      boxShadow: selectedBackup?.path === backup.path ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: selectedBackup?.path === backup.path ? 'white' : '#6b7280'
                      }} />
                      <span style={{ fontWeight: '500' }}>{formatTimestamp(backup.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items List */}
        <div style={{ backgroundColor: '#2d2d2d', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginBottom: '4px', textTransform: 'capitalize' }}>
                  Lovelace
                </h2>
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                  {selectedBackup ? formatTimestamp(selectedBackup.createdAt) : 'No backup selected'}
                </p>
              </div>
              
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{ 
                  padding: '6px 40px 6px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 16px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1em',
                }}
              >
                <option value="default">Default Order</option>
                <option value="alpha-asc">A → Z</option>
                <option value="alpha-desc">Z → A</option>
              </select>
            </div>

            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={`Search Lovelace Files...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', paddingLeft: '48px', paddingRight: '16px', paddingTop: '12px', paddingBottom: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', color: 'white', fontSize: '14px' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {isLoadingItems && <p style={{ textAlign: 'center', color: '#9ca3af' }}>Loading Lovelace Files...</p>}
            {error && !isLoadingItems && <p style={{ textAlign: 'center', color: '#ef4444' }}>{error}</p>}
            {!selectedBackup && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <svg style={{ width: '32px', height: '32px', color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <p style={{ color: '#9ca3af' }}>Select a backup to view Lovelace files</p>
              </div>
            )}
            {!isLoadingItems && selectedBackup && sortedAndFilteredItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sortedAndFilteredItems.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    onClick={() => handleSelectItem(item)}
                    style={{ width: '100%', textAlign: 'left', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ color: 'white', fontWeight: '500', marginBottom: '4px' }}>
                          {item.name}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg style={{ width: '20px', height: '20px', color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!isLoadingItems && selectedBackup && items.length === 0 && (
              <p style={{ textAlign: 'center', color: '#6b7280' }}>No Lovelace files found in this backup.</p>
            )}
          </div>
        </div>
      </div>

      {selectedItem && (
        <LovelaceDiffViewer 
          backupFileContent={backupFileContent}
          liveFileContent={liveFileContent}
          fileName={selectedItem.name}
          backupTimestamp={selectedBackup ? selectedBackup.createdAt : 0}
          onClose={() => setSelectedItem(null)}
          onRestore={handleRestore}
        />
      )}
    </>
  );
}
