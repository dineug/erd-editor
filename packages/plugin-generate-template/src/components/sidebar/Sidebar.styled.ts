import styled from 'styled-components';

import { Container as IconContainer } from '@/components/Icon.styled';

export const Container = styled.div`
  height: 100%;
  background-color: var(--vuerd-color-contextmenu);
  overflow: hidden;
`;

export const TabGroup = styled.div`
  display: flex;
  height: 30px;
  overflow: hidden;
  align-items: center;
`;

export const Tab = styled.div<{ active?: boolean }>`
  display: flex;
  align-items: center;
  height: 100%;
  color: ${({ active }) =>
    active ? 'var(--vuerd-color-font-active)' : 'var(--vuerd-color-font)'};
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 10px;
  font-size: 14px;
  &:hover {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
  }
  &:hover ${IconContainer} {
    fill: var(--vuerd-color-font-active);
  }
`;
