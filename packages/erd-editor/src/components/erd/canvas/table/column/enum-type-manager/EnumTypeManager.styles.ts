import { css } from '@dineug/r-html';

export const container = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
`;

export const header = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;

  h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }
`;

export const closeButton = css`
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;

  &:hover {
    color: var(--text-color);
  }
`;

export const valuesList = css`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
  padding: 6px 0;
`;

export const valueItem = css`
  display: flex;
  gap: 6px;
  align-items: center;
`;

export const valueInput = css`
  flex: 1;
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--background-color);
  color: var(--text-color);

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-color-alpha);
  }
`;

export const removeButton = css`
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;
  flex-shrink: 0;

  &:hover {
    color: var(--error-color);
  }
`;

export const inputSection = css`
  display: flex;
  gap: 6px;
  align-items: center;
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
`;

export const newValueInput = css`
  flex: 1;
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--background-color);
  color: var(--text-color);

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-color-alpha);
  }
`;

export const addButton = css`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--primary-color-dark);
  }

  &:active {
    opacity: 0.8;
  }
`;

export const preview = css`
  padding: 6px;
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  margin-top: 4px;

  label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--text-secondary);
  }

  code {
    display: block;
    padding: 4px;
    background: var(--surface-color);
    border-radius: 2px;
    color: var(--text-color);
    word-break: break-all;
    font-size: 10px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }
`;
