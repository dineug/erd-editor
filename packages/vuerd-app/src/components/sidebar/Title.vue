<script lang="tsx">
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    label: {
      type: String,
      default: '',
    },
  },
  setup: props => () =>
    (
      <div class="flex items-center overflow-hidden box-border pl-2 pr-2 h-8">
        <div class="overflow-hidden overflow-ellipsis pl-3 whitespace-nowrap">
          <span class="overflow-hidden text-sm">{props.label}</span>
        </div>
      </div>
    ),
});
</script>
