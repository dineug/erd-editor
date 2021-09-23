<script lang="tsx">
import { defineComponent } from 'vue';
import { getIcon } from '@/core/icon';

const SIZE = 24;
const SIZE_REM = 1.5;

export default defineComponent({
  props: {
    prefix: {
      type: String,
      default: 'fas',
    },
    name: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      default: SIZE,
    },
    color: {
      type: String,
      default: null,
    },
  },
  setup(props) {
    const icon = getIcon(props.prefix, props.name);
    if (!icon) return () => <div />;

    const [width, height, , , d] = icon.icon;
    const rem = SIZE_REM * (props.size / SIZE);

    return () => (
      <svg
        class="svg-icon"
        style={{
          width: `${rem}rem`,
          height: `${rem}rem`,
        }}
        viewBox={`0 0 ${width} ${height}`}
      >
        <path d={d} fill={props.color}></path>
      </svg>
    );
  },
});
</script>

<style scoped lang="scss">
.svg-icon {
  display: inline-flex;
  transition: fill 0.15s;
}
</style>
