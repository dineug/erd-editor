import { Button, Flex, Text } from '@radix-ui/themes';
import { atom, useAtom } from 'jotai';

const countAtom = atom(0);

const App: React.FC = () => {
  const [count, setCount] = useAtom(countAtom);

  return (
    <Flex direction="column" width={'100%'}>
      <Text>App {count}</Text>
      <Button onClick={() => setCount(count + 1)}>Click</Button>
    </Flex>
  );
};

export default App;
