import { useRouteError } from 'react-router-dom';

import * as styles from './LiveCollaborativeError.styles';

interface LiveCollaborativeErrorProps {}

const LiveCollaborativeError: React.FC<LiveCollaborativeErrorProps> = () => {
  const error = useRouteError();

  return <div>LiveCollaborativeError</div>;
};

export default LiveCollaborativeError;
