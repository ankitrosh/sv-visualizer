module cpu (
    input  logic clk,
    input  logic rst_n,
    output logic [31:0] bus_out,
    output logic [15:0] mem_addr
);

    wire [31:0] core_result;
    wire [15:0] core_addr;
    wire        cache_hit;

    core u_core (
        .clk(clk),
        .rst_n(rst_n),
        .result(core_result),
        .addr(core_addr)
    );

    l2_cache u_l2 (
        .clk(clk),
        .addr(core_addr),
        .data(core_result),
        .hit(cache_hit)
    );

    assign bus_out  = core_result;
    assign mem_addr = core_addr;

endmodule
